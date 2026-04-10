import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ImagePlus, ArrowLeft, Mic, Square, Paperclip, FileText, LayoutTemplate, X } from "lucide-react";
import moment from "moment";
import { motion } from "framer-motion";

export default function Chat() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [groupConv, setGroupConv] = useState(null);
  const [activeConvId, setActiveConvId] = useState(null);
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

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadUser = async () => {
    const me = await base44.auth.me();
    setUser(me);
    await loadConversations(me);
    if (me.role === 'doctor') {
      const tmpl = await base44.entities.MessageTemplate.list('-created_date', 100);
      setTemplates(tmpl);
    }
    setLoading(false);
  };

  const loadConversations = async (me) => {
    const assignments = await base44.entities.PatientDoctorAssignment.filter(
      me.role === "doctor" ? { doctor_email: me.email } : { patient_email: me.email }
    );
    setConversations(assignments);

    // For patients with multiple doctors, create a group conversation
    if (me.role === "patient" && assignments.length > 1) {
      const groupId = `group_${me.email}`;
      setGroupConv({
        id: groupId,
        convId: groupId,
        name: "Care Team",
        members: assignments.map((a) => ({ name: a.doctor_name, email: a.doctor_email })),
      });
    }

    if (assignments.length === 1) {
      const a = assignments[0];
      const convId = [a.patient_email, a.doctor_email].sort().join("_");
      setActiveConvId(convId);
      setChatPartner(me.role === "doctor" ? { name: a.patient_name, email: a.patient_email } : { name: a.doctor_name, email: a.doctor_email });
    }
  };

  const loadMessages = async () => {
    if (!activeConvId) return;
    const msgs = await base44.entities.ChatMessage.filter({ conversation_id: activeConvId }, "created_date", 100);
    setMessages(msgs);
  };

  const selectConversation = (assignment) => {
    if (assignment.isGroup) {
      setActiveConvId(assignment.convId);
      setChatPartner({ name: assignment.name, email: null });
      setIsGroupChat(true);
      return;
    }
    setIsGroupChat(false);
    const convId = [assignment.patient_email, assignment.doctor_email].sort().join("_");
    setActiveConvId(convId);
    setChatPartner(
      user.role === "doctor"
        ? { name: assignment.patient_name, email: assignment.patient_email }
        : { name: assignment.doctor_name, email: assignment.doctor_email }
    );
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

    await base44.entities.ChatMessage.create(msgData);
    setNewMsg("");
    setSending(false);
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
    await base44.entities.ChatMessage.create({
      sender_email: user.email,
      receiver_email: partnerEmail,
      conversation_id: activeConvId,
      message_type: "audio",
      audio_url: file_url,
    });
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

  // Conversation list view
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
            {conversations.map((a) => (
              <button
                key={a.id}
                onClick={() => selectConversation(a)}
                className="w-full bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {(user.role === "doctor" ? a.patient_name : a.doctor_name || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {user.role === "doctor" ? a.patient_name : a.doctor_name || "Doctor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "doctor" ? "Patient" : "Your Doctor"}
                  </p>
                </div>
              </button>
            ))}
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
          <Button variant="ghost" size="icon" onClick={() => { setActiveConvId(null); setChatPartner(null); setIsGroupChat(false); }}>
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
        {messages.map((msg) => {
          const isMe = msg.sender_email === user.email;
          return (
            <motion.div
              key={msg.id}
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
                <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? "text-right" : ""}`}>
                  {moment(msg.created_date).format("h:mm A")}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="relative flex items-center gap-2 pt-3 border-t border-border">
        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
        <input type="file" ref={fileDocRef} className="hidden" onChange={handleFileUpload} />
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