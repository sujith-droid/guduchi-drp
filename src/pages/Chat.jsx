import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ImagePlus, ArrowLeft, Mic, Square, Paperclip, FileText, LayoutTemplate, X, Check, CheckCheck, Phone, Download, Trash2 } from "lucide-react";
import moment from "moment-timezone";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { appParams } from "@/lib/app-params";
import { isPatientRole } from "@/lib/roles";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";

export default function Chat() {
  const { convId: convIdParam } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [conversations, setConversations] = useState([]);
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
  const [partnerPhone, setPartnerPhone] = useState(null);

  // activeConvId comes from URL param
  const activeConvId = convIdParam ? decodeURIComponent(convIdParam) : null;

  useEffect(() => {
    if (user) initChat();
  }, [user]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages();
      const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
        if (event.data?.conversation_id === activeConvId) {
          loadMessages();
        }
      });
      return unsubscribe;
    }
  }, [activeConvId, user]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleRefresh = useCallback(async () => {
    await initChat();
  }, [user]);

  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    scrollRef.current = document.getElementById("main-scroll");
  }, []);
  const { pullDistance, isRefreshing } = usePullToRefresh(handleRefresh, { scrollRef });

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
    const doctorSide = !isPatientRole(me.role);

    if (doctorSide) {
      // Doctors: list only patients who have actually messaged, newest first
      const [sent, received] = await Promise.all([
        base44.entities.ChatMessage.filter({ sender_email: me.email }, "-created_date", 500),
        base44.entities.ChatMessage.filter({ receiver_email: me.email }, "-created_date", 500),
      ]);
      const convMap = {};
      for (const m of [...sent, ...received]) {
        const cid = m.conversation_id;
        if (!convMap[cid] || new Date(m.created_date) > new Date(convMap[cid].created_date)) {
          convMap[cid] = m;
        }
      }
      const assignments = await base44.entities.PatientDoctorAssignment.filter({ doctor_email: me.email });
      const nameMap = {};
      for (const a of assignments) {
        const cid = [a.patient_email, a.doctor_email].sort().join("_");
        nameMap[cid] = a.patient_name;
      }
      const convList = Object.entries(convMap).map(([cid, latest]) => {
        const patientEmail = latest.sender_email === me.email ? latest.receiver_email : latest.sender_email;
        return {
          id: cid,
          conversation_id: cid,
          patient_email: patientEmail,
          doctor_email: me.email,
          patient_name: nameMap[cid] || patientEmail,
          latest_message: latest.message || (latest.audio_url ? "🎤 Voice message" : latest.image_url ? "📷 Photo" : ""),
          latest_time: latest.created_date,
        };
      });
      convList.sort((a, b) => new Date(b.latest_time) - new Date(a.latest_time));
      setConversations(convList);

      const map = {};
      for (const m of received) {
        if (!m.is_read) map[m.conversation_id] = (map[m.conversation_id] || 0) + 1;
      }
      setUnreadMap(map);
      return;
    }

    // Patient flow — list assigned doctors
    const assignments = await base44.entities.PatientDoctorAssignment.filter({ patient_email: me.email, status: 'active' });
    setConversations(assignments);
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

    if (!convIdParam && assignments.length === 1) {
      const a = assignments[0];
      const cId = [a.patient_email, a.doctor_email].sort().join("_");
      navigate(`/chat/${encodeURIComponent(cId)}`, { replace: true });
    }
  };

  // Derive chatPartner from activeConvId + conversations
  useEffect(() => {
    if (!activeConvId || !user || conversations.length === 0) return;
    const match = conversations.find((a) => {
      const cId = [a.patient_email, a.doctor_email].sort().join("_");
      return cId === activeConvId;
    });
    if (match) {
      setChatPartner(
        !isPatientRole(user.role)
          ? { name: match.patient_name, email: match.patient_email }
          : { name: match.doctor_name, email: match.doctor_email }
      );
    }
  }, [activeConvId, conversations, user]);

  // Fetch the chat partner's phone number so the Call button can dial it.
  // Use fetch directly (not base44.functions.invoke) so the AdminSession UUID
  // is NOT sent as a Bearer token — the Base44 platform rejects it as 401
  // before the function runs. The adminToken goes in the request body instead.
  useEffect(() => {
    setPartnerPhone(null);
    if (!chatPartner?.email) return;
    const adminToken = localStorage.getItem("admin_session_token");
    fetch(`/api/apps/${appParams.appId}/functions/getUserPhone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_email: chatPartner.email, adminToken }),
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data) => setPartnerPhone(data?.phone || null))
      .catch(() => {});
  }, [chatPartner?.email]);

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

  const deleteMessage = async (msg) => {
    try {
      await base44.entities.ChatMessage.delete(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  };

  const selectConversation = (assignment) => {
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
      receiver_email: chatPartner.email,
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
    await notifyReceiver(chatPartner.email, msgData.message || (imageUrl ? "📷 Photo" : "New message"));
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
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
        <h1 className="text-2xl font-heading font-bold">Messages</h1>
        {conversations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No conversations yet.</p>
            <p className="text-xs mt-1">You'll be able to chat once assigned to a {user?.role === "doctor" ? "patient" : "doctor"}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((a) => {
              const cId = [a.patient_email, a.doctor_email].sort().join("_");
              const unread = unreadMap[cId] || 0;
              const doctorSide = !isPatientRole(user.role);
              return (
              <button
                key={a.id}
                onClick={() => selectConversation(a)}
                className="w-full bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {(doctorSide ? a.patient_name : a.doctor_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {doctorSide ? a.patient_name : a.doctor_name || "Doctor"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doctorSide ? (a.latest_message || "Tap to open chat") : "Your Doctor"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {unread > 0 ? (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {unread}
                    </span>
                  ) : (doctorSide && a.latest_time ? (
                    <span className="text-xs text-muted-foreground">{moment.utc(a.latest_time).tz("Asia/Kolkata").format("h:mm A")}</span>
                  ) : null)}
                </div>
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
        {conversations.length > 1 && (
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
          {chatPartner?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{chatPartner?.name || "Chat"}</p>
          <p className="text-xs text-muted-foreground">
            {!isPatientRole(user.role) ? "Patient" : "Your Doctor"}
          </p>
        </div>
        {partnerPhone ? (
          <a href={`tel:${partnerPhone}`}>
            <Button size="sm" variant="outline" className="gap-1">
              <Phone className="h-3 w-3" /> Call
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" disabled className="gap-1 opacity-50">
            <Phone className="h-3 w-3" /> No Phone
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 chat-messages-scroll">
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
                <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">{dateLabel}</span>
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${isMe ? "order-1" : ""} group/msg`}>
                <div className={`relative rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}>
                  {msg.audio_url && (
                    <audio controls src={msg.audio_url} className="max-w-full h-8" />
                  )}
                  {msg.image_url && (
                    /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(msg.image_url) ? (
                      <div className="relative group mb-2">
                        <img src={msg.image_url} alt="Shared" className="rounded-lg max-w-full max-h-48 object-cover" />
                        <a
                          href={msg.image_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Download image"
                          className="absolute top-1.5 right-1.5 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
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
                  {!isPatientRole(user.role) && !msg._pending && (
                    <button
                      onClick={() => deleteMessage(msg)}
                      aria-label="Delete message"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity shadow-md"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  </div>
                <p className={`text-xs text-muted-foreground mt-1 flex items-center gap-1 ${isMe ? "justify-end" : ""}`}>
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
      <div className="relative flex flex-wrap items-center gap-2 pt-3 border-t border-border">
        <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} />
        <input type="file" ref={fileDocRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileUpload} />
        {showTemplates && templates.length > 0 && (
          <div className="absolute bottom-16 left-0 right-0 bg-card border border-border rounded-xl shadow-lg p-3 max-h-52 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">Templates</p>
              <Button variant="ghost" size="icon" aria-label="Close templates" className="h-5 w-5" onClick={() => setShowTemplates(false)}><X className="h-3 w-3" /></Button>
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
            <Button variant="ghost" size="icon" aria-label="Upload image" onClick={() => fileInputRef.current?.click()} disabled={sending} className="shrink-0 min-h-[44px] min-w-[44px]">
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Attach file" onClick={() => fileDocRef.current?.click()} disabled={sending} className="shrink-0 min-h-[44px] min-w-[44px] hidden sm:flex">
              <Paperclip className="h-5 w-5" />
            </Button>
            {user?.role === 'doctor' && (
              <Button variant="ghost" size="icon" aria-label="Message templates" onClick={() => setShowTemplates((v) => !v)} disabled={sending} className="shrink-0 min-h-[44px] min-w-[44px] hidden sm:flex">
                <LayoutTemplate className="h-5 w-5" />
              </Button>
            )}
            <Input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 min-w-[120px]"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(null, null)}
            />
            <Button size="icon" variant="ghost" aria-label="Record voice message" onClick={startRecording} disabled={sending} className="shrink-0 min-h-[44px] min-w-[44px]">
              <Mic className="h-5 w-5" />
            </Button>
            <Button size="icon" aria-label="Send message" onClick={() => sendMessage(null, null)} disabled={sending || !newMsg.trim()} className="shrink-0 min-h-[44px] min-w-[44px]">
              <Send className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-600 font-medium">Recording... {recordingSeconds}s</span>
            </div>
            <Button size="icon" variant="destructive" aria-label="Stop recording" onClick={sendVoiceMessage} disabled={sending}>
              <Square className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}