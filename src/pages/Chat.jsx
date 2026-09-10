import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ImagePlus, ArrowLeft, Mic, Square, Paperclip, FileText, LayoutTemplate, X, Check, CheckCheck } from "lucide-react";
import moment from "moment-timezone";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { isPatientRole } from "@/lib/roles";

export default function Chat() {
  const { convId: convIdParam } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [groupConv, setGroupConv] = useState(null);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEnd = useRef(null);
  const fileInputRef = useRef(null);
  const fileDocRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  const [unreadMap, setUnreadMap] = useState({});

  // activeConvId comes from URL param
  const activeConvId = convIdParam ? decodeURIComponent(convIdParam) : null;

  useEffect(() => {
    if (user) initChat();
  }, [user]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [activeConvId, user]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initChat = async () => {
    try {
      await loadConversations(user);
      if (user.role === 'doctor') {
        try {
          const adminToken = localStorage.getItem("admin_session_token");
          const res = await base44.functions.invoke("doctorApi", { adminToken, action: "getTemplates" });
          setTemplates((res.data || res).templates || []);
        } catch (e) {
          console.error("Failed to load templates", e);
        }
      }
    } catch (e) {
      console.error("Failed to load chat", e);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (me) => {
    const assignments = await base44.entities.PatientDoctorAssignment.filter(
      me.role === "doctor" ? { doctor_email: me.email } : { patient_email: me.email }
    );
    setConversations(assignments);
    // Fetch unread message counts per conversation (resilient — don't block page load)
    let allUnread = [];
    try {
      allUnread = await base44.entities.ChatMessage.filter({ receiver_email: me.email, is_read: false });
    } catch (e) {
      console.error("Failed to load unread messages", e);
    }
    const map = {};
    for (const m of allUnread) {
      map[m.conversation_id] = (map[m.conversation_id] || 0) + 1;
    }
    setUnreadMap(map);

    // For patients with multiple doctors, create a group conversation
    if (isPatientRole(me.role) && assignments.length > 1) {
      const groupId = `group_${me.email}`;
      setGroupConv({
        id: groupId,
        convId: groupId,
        name: "Care Team",
        members: assignments.map((a) => ({ name: a.doctor_name, email: a.doctor_email })),
      });
    }

    // Auto-navigate if there's only one conversation and no param yet
    if (!convIdParam) {
      if (isPatientRole(me.role) && assignments.length > 1) {
        const groupId = `group_${me.email}`;
        navigate(`/chat/${encodeURIComponent(groupId)}`, { replace: true });
      } else if (assignments.length === 1) {
        const a = assignments[0];
        const cId = [a.patient_email, a.doctor_email].sort().join("_");
        navigate(`/chat/${encodeURIComponent(cId)}`, { replace: true });
      }
    }
  };

  // Derive chatPartner from activeConvId + conversations
  useEffect(() => {
    if (!activeConvId || !user || conversations.length === 0) return;
    if (activeConvId.startsWith("group_")) {
      setChatPartner({ name: "Care Team", email: null });
      setIsGroupChat(true);
      return;
    }
    setIsGroupChat(false);
    const match = conversations.find((a) => {
      const cId = [a.patient_email, a.doctor_email].sort().join("_");
      return cId === activeConvId;
    });
    if (match) {
      setChatPartner(
        user.role === "doctor"
          ? { name: match.patient_name, email: match.patient_email }
          : { name: match.doctor_name, email: match.doctor_email }
      );
    }
  }, [activeConvId, conversations, user]);

  const loadMessages = async () => {
    if (!activeConvId) return;
    try {
      const msgs = await base44.entities.ChatMessage.filter({ conversation_id: activeConvId }, "created_date", 100);
      setMessages(msgs);
      // Mark incoming messages as read
      if (user) {
        const unread = msgs.filter(m => m.receiver_email === user.email && !m.is_read);
        for (const m of unread) {
          await base44.entities.ChatMessage.update(m.id, { is_read: true });
        }
      }
    } catch {
      // Silently ignore transient network errors during polling
    }
  };

  const selectConversation = (assignment) => {
    if (assignment.isGroup) {
      navigate(`/chat/${encodeURIComponent(assignment.convId)}`);
      return;
    }
    const cId = [assignment.patient_email, assignment.doctor_email].sort().join("_");
    navigate(`/chat/${encodeURIComponent(cId)}`);
  };

  const notifyReceiver = async (receiverEmail, preview) => {
    if (!receiverEmail) return;
    const patientEmail = isPatientRole(user.role) ? user.email : receiverEmail;
    await base44.entities.Notification.create({
      user_email: receiverEmail,
      title: `New message from ${user.full_name || user.email}`,
      message: preview.substring(0, 100),
      type: "info",
      related_patient_email: patientEmail,
    }).catch(() => {});
  };

  const sendMessage = async (imageUrl, audioUrl) => {
    if (!newMsg.trim() && !imageUrl && !audioUrl) return;
    setSending(true);

    const msgData = {
      sender_email: user.email,
      receiver_email: isGroupChat ? "group" : chatPartner.email,
      conversation_id: activeConvId,
      message: newMsg.trim() || undefined,
      message_type: imageUrl ? (newMsg.trim() ? "text_image" : "image") : "text",
    };
    if (imageUrl) msgData.image_url = imageUrl;

    // Optimistic update — show message instantly
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg = { ...msgData, id: optimisticId, created_date: new Date().toISOString(), _pending: true };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMsg("");

    await base44.entities.ChatMessage.create(msgData);
    await notifyReceiver(isGroupChat ? null : chatPartner.email, msgData.message || (imageUrl ? "📷 Photo" : "New message"));
    setSending(false);
    // Replace optimistic with real data
    loadMessages();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await sendMessage(file_url, null);
    setSending(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const partnerEmail = chatPartner.email;
    await base44.entities.ChatMessage.create({
      sender_email: user.email,
      receiver_email: partnerEmail,
      conversation_id: activeConvId,
      message: file.name,
      message_type: 'text',
      image_url: file_url,
    });
    await notifyReceiver(partnerEmail, `📎 ${file.name}`);
    setSending(false);
    loadMessages();
  };

  const sendTemplate = async (template) => {
    setShowTemplates(false);
    setSending(true);
    const partnerEmail = chatPartner.email;
    await base44.entities.ChatMessage.create({
      sender_email: user.email,
      receiver_email: partnerEmail,
      conversation_id: activeConvId,
      message: template.content,
      message_type: 'text',
    });
    await notifyReceiver(partnerEmail, template.content);
    setSending(false);
    loadMessages();
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = () => resolve();
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    });
  };

  const sendVoiceMessage = async () => {
    await stopRecording();
    setSending(true);
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const file = new File([blob], "voice.webm", { type: "audio/webm" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const partnerEmail = chatPartner.email;

    // Optimistic
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: optimisticId, sender_email: user.email, receiver_email: partnerEmail,
      conversation_id: activeConvId, message_type: "audio", audio_url: file_url,
      created_date: new Date().toISOString(), _pending: true,
    }]);

    await base44.entities.ChatMessage.create({
      sender_email: user.email,
      receiver_email: partnerEmail,
      conversation_id: activeConvId,
      message_type: "audio",
      audio_url: file_url,
    });
    await notifyReceiver(partnerEmail, "🎤 Voice message");
    setSending(false);
    loadMessages();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Conversation list view — shown when no convId in URL
  if (!activeConvId) {
    return (
      <div className="space-y-4 pb-20 md:pb-6">
        <h1 className="text-2xl font-heading font-bold">Messages</h1>
        {conversations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No conversations yet.</p>
            <p className="text-xs mt-1">You'll be able to chat once assigned to a {user?.role === "doctor" ? "patient" : "doctor"}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Group conversation for patients with multiple doctors */}
            {groupConv && (
              <button
                onClick={() => selectConversation({ ...groupConv, isGroup: true })}
                className="w-full bg-gradient-to-r from-primary/10 to-accent border border-primary/30 rounded-xl p-4 flex items-center gap-3 hover:border-primary/50 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  👥
                </div>
                <div>
                  <p className="font-semibold text-sm">Care Team Group</p>
                  <p className="text-xs text-muted-foreground">{groupConv.members.map((m) => `Dr. ${m.name}`).join(", ")}</p>
                </div>
              </button>
            )}
            {/* Show individual chats only when patient has exactly 1 doctor */}
            {!groupConv && conversations.map((a) => {
              const cId = [a.patient_email, a.doctor_email].sort().join("_");
              const unread = unreadMap[cId] || 0;
              return (
              <button
                key={a.id}
                onClick={() => selectConversation(a)}
                className="w-full bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {(user.role === "doctor" ? a.patient_name : a.doctor_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {user.role === "doctor" ? a.patient_name : a.doctor_name || "Doctor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "doctor" ? "Patient" : "Your Doctor"}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] pb-16 md:pb-0">
      {/* Chat Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        {(conversations.length > 1 || groupConv) && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
          {chatPartner?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <p className="font-medium text-sm">{chatPartner?.name || "Chat"}</p>
          <p className="text-xs text-muted-foreground">
            {user.role === "doctor" ? "Patient" : "Your Doctor"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Start the conversation by sending a message.
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.sender_email === user.email;
          const prevMsg = messages[idx - 1];
          const showDateSep = !prevMsg || !moment.utc(prevMsg.created_date).tz("Asia/Kolkata").isSame(moment.utc(msg.created_date).tz("Asia/Kolkata"), "day");
          const dateLabel = (() => {
            const m = moment.utc(msg.created_date).tz("Asia/Kolkata");
            if (m.isSame(moment.tz("Asia/Kolkata").startOf("day"), "day")) return "Today";
            if (m.isSame(moment.tz("Asia/Kolkata").subtract(1, "day").startOf("day"), "day")) return "Yesterday";
            return m.format("MMM D, YYYY");
          })();
          return (
            <div key={msg.id}>
            {showDateSep && (
              <div className="flex items-center justify-center my-3">
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">{dateLabel}</span>
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${isMe ? "order-1" : ""}`}>
                <div className={`rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}>
                  {msg.audio_url && (
                    <audio controls src={msg.audio_url} className="max-w-full h-8" />
                  )}
                  {msg.image_url && (
                    /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(msg.image_url) ? (
                      <img src={msg.image_url} alt="Shared" className="rounded-lg max-w-full max-h-48 object-cover mb-2" />
                    ) : (
                      <a
                        href={msg.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-lg text-sm underline mb-2"
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        {msg.message || "Download file"}
                      </a>
                    )
                  )}
                  {msg.message && <p className="text-sm">{msg.message}</p>}
                </div>
                <p className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1 ${isMe ? "justify-end" : ""}`}>
                  {moment.utc(msg.created_date).tz("Asia/Kolkata").format("h:mm A")}
                  {isMe && !msg._pending && (
                    msg.is_read
                      ? <CheckCheck className="h-3 w-3 text-primary" />
                      : <Check className="h-3 w-3" />
                  )}
                </p>
              </div>
            </motion.div>
            </div>
          );
        })}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="relative flex items-center gap-2 pt-3 border-t border-border">
        <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} />
        <input type="file" ref={fileDocRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileUpload} />
        {showTemplates && templates.length > 0 && (
          <div className="absolute bottom-16 left-0 right-0 bg-card border border-border rounded-xl shadow-lg p-3 max-h-52 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">Templates</p>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowTemplates(false)}><X className="h-3 w-3" /></Button>
            </div>
            {templates.map((t) => (
              <button key={t.id} onClick={() => sendTemplate(t)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm mb-1 border border-transparent hover:border-border transition-colors">
                <p className="font-medium text-xs">{t.name}</p>
                <p className="text-muted-foreground text-xs truncate mt-0.5">{t.content}</p>
              </button>
            ))}
          </div>
        )}
        {!isRecording ? (
          <>
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={sending}>
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fileDocRef.current?.click()} disabled={sending}>
              <Paperclip className="h-5 w-5" />
            </Button>
            {user?.role === 'doctor' && (
              <Button variant="ghost" size="icon" onClick={() => setShowTemplates((v) => !v)} disabled={sending}>
                <LayoutTemplate className="h-5 w-5" />
              </Button>
            )}
            <Input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(null, null)}
            />
            <Button size="icon" variant="ghost" onClick={startRecording} disabled={sending}>
              <Mic className="h-5 w-5" />
            </Button>
            <Button size="icon" onClick={() => sendMessage(null, null)} disabled={sending || !newMsg.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-600 font-medium">Recording... {recordingSeconds}s</span>
            </div>
            <Button size="icon" variant="destructive" onClick={sendVoiceMessage} disabled={sending}>
              <Square className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}