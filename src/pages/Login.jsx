import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LogIn, KeyRound, Loader2, AlertCircle, ArrowLeft, RefreshCw, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ErrorMsg = ({ msg }) => msg ? (
  <div className="flex items-center gap-1.5 mt-1.5 text-red-500 text-sm">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>{msg}</span>
  </div>
) : null;

export default function Login() {
  const navigate = useNavigate();
  const { loginAdminSession } = useAuth();

  // step: 1 = Enter Mobile Number, 3 = Enter OTP
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState({});
  const [notRegistered, setNotRegistered] = useState(false);

  // Force light color tokens on auth pages so typed text and OTP slots stay
  // readable on the white card (system dark mode would otherwise flip tokens
  // while the card stays white, making input text invisible).
  useEffect(() => {
    document.documentElement.classList.add('light');
    return () => document.documentElement.classList.remove('light');
  }, []);

  useEffect(() => {
    let timer;
    if (step === 3 && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleIdentifierChange = (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 10) val = val.substring(0, 10);
    setIdentifier(val);
    setErrors({});
    setNotRegistered(false);
  };

  const getFormattedPhone = () => {
    let phone = identifier.replace(/\s/g, "");
    if (!phone.startsWith('+')) phone = '+91' + phone;
    return phone;
  };

  const validateIdentifier = () => {
    const cleaned = identifier.replace(/\s/g, "");
    if (!cleaned.match(/^\d{10}$/)) return "Please enter a valid 10-digit mobile number.";
    return null;
  };

  const handlePostLogin = (user) => {
    if (!user.profile_complete) navigate("/setup");
    else if (user.role === "admin") navigate("/admin");
    else if (user.role === "doctor") navigate("/doctor");
    else navigate("/");
  };

  const handleStep1 = async (e) => {
    e.preventDefault();
    const err = validateIdentifier();
    if (err) return setErrors({ identifier: err });
    setLoading(true);
    try {
      await base44.functions.invoke("sendOtp", { phone: getFormattedPhone() });
      setStep(3);
      setCountdown(30);
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message || "An error occurred.";
      if (serverMsg.includes("No account found") || serverMsg.includes("User not found")) {
        setNotRegistered(true);
      } else {
        setErrors({ form: serverMsg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPLogin = async (e) => {
    e.preventDefault();
    if (otp.length !== 4) return setErrors({ otp: "Please enter a valid 4-digit OTP." });
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verifyOtp", { phone: getFormattedPhone(), code: otp });
      const responseData = res.data || res;
      if (!responseData.user) throw new Error("Login failed. Please try again.");
      if (isAdminMode && responseData.user.role !== "admin") {
        setErrors({ otp: "This account does not have admin access." });
        return;
      }
      // All OTP users get an opaque AdminSession token persisted in localStorage
      // so they stay logged in across app restarts (90-day expiry).
      loginAdminSession(responseData.token, responseData.user);
      handlePostLogin(responseData.user);
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Invalid OTP code.";
      setErrors({ otp: serverMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setErrors({});
    try {
      await base44.functions.invoke("resendOtp", { phone: getFormattedPhone() });
      setCountdown(30);
      setOtp("");
    } catch (err) {
      setErrors({ otp: err.response?.data?.error || "Failed to resend OTP." });
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    const params = new URLSearchParams();
    params.set('phone', identifier.replace(/\s/g, ""));
    navigate(`/signup?${params.toString()}`);
  };

  const toggleAdminMode = () => {
    setIsAdminMode(!isAdminMode);
    setIdentifier("");
    setErrors({});
    setNotRegistered(false);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-green-50 to-emerald-100 dark:bg-none dark:bg-background flex items-center justify-center p-4 pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-card dark:text-card-foreground rounded-3xl shadow-2xl overflow-hidden relative border dark:border-border">

          {/* Header */}
          <div className={`p-8 text-center text-white transition-colors duration-500 ${isAdminMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950' : 'bg-gradient-to-br from-primary to-emerald-600 dark:from-emerald-900 dark:to-emerald-950'}`}>
            <div className="flex justify-center mb-3">
              <div className="bg-white dark:bg-card p-1 rounded-full backdrop-blur-sm shadow-inner">
                <img src="/logo.png" alt="Logo" className="h-20 w-20 rounded-full object-cover" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">
              {step === 1 ? (isAdminMode ? "Admin Portal" : "Welcome Back") : "Enter OTP Code"}
            </h1>
            <p className="text-white/75 text-sm mt-1">
              {step === 1 ? (isAdminMode ? "Sign in with your mobile number" : "Sign in with your Mobile Number") : `Code sent to ${getFormattedPhone()}`}
            </p>
          </div>

          {/* Body */}
          <div className="p-8">
            {errors.form && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.form}
              </div>
            )}

            {/* STEP 1: Enter Mobile Number */}
            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-foreground font-medium">Mobile Number</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-muted-foreground font-medium">+91</div>
                    <Input
                      type="tel"
                      placeholder="1234567890"
                      value={identifier}
                      onChange={handleIdentifierChange}
                      className={`pl-12 text-lg tracking-wide ${errors.identifier || notRegistered ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                      autoFocus
                    />
                  </div>
                  <ErrorMsg msg={errors.identifier} />
                  {notRegistered && (
                    <div className="mt-3 p-4 bg-orange-50 border border-orange-200 rounded-xl animate-in slide-in-from-top-2">
                      <div className="flex gap-2 text-orange-800 text-sm font-medium mb-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-orange-500" />
                        This mobile number is not registered.
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => { setNotRegistered(false); setIdentifier(""); }} className="flex-1 bg-white dark:bg-card dark:text-card-foreground">Cancel</Button>
                        <Button type="button" onClick={goToRegister} className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600 text-white"><UserPlus className="w-4 h-4" /> Register</Button>
                      </div>
                    </div>
                  )}
                </div>

                {!notRegistered && (
                  <Button type="submit" className={`w-full h-12 text-base font-semibold rounded-xl gap-2 mt-4 ${isAdminMode ? 'bg-slate-800 hover:bg-slate-900 dark:bg-primary dark:hover:bg-primary/90 text-white' : ''}`} disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                    {loading ? "Sending..." : "Continue"}
                  </Button>
                )}

                {!isAdminMode && (
                  <p className="text-center text-sm text-slate-500 dark:text-muted-foreground mt-4">
                    Don't have an account?{" "}
                    <Link to="/signup" className="text-primary font-semibold hover:underline">Register here</Link>
                  </p>
                )}

                
              </form>
            )}

            {/* STEP 3: OTP */}
            {step === 3 && (
              <form onSubmit={handleOTPLogin} className="space-y-6 flex flex-col items-center">
                <div className="w-full space-y-3 text-center">
                  <div className="flex justify-center py-2">
                    <InputOTP maxLength={4} value={otp} onChange={(val) => { setOtp(val); setErrors({}); }} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <ErrorMsg msg={errors.otp} />
                </div>

                <Button type="submit" className="w-full h-12 text-base font-semibold rounded-xl gap-2" disabled={loading || otp.length !== 4}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
                  {loading ? "Verifying..." : "Verify"}
                </Button>

                <div className="flex gap-3 w-full">
                  <button type="button" onClick={() => { setStep(1); setOtp(""); setErrors({}); }}
                    className="flex-1 flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-primary dark:text-muted-foreground dark:hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Change Number
                  </button>
                  <button type="button" onClick={handleResend} disabled={loading || countdown > 0}
                    className="flex-1 flex items-center justify-center gap-1 text-sm text-primary hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors">
                    <RefreshCw className="w-4 h-4" />
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}