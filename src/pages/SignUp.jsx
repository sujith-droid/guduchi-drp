import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

const ErrorMsg = ({ msg }) => msg ? (
  <div className="flex items-center gap-1.5 mt-1.5 text-red-500 text-sm animate-in slide-in-from-top-1">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>{msg}</span>
  </div>
) : null;

const PasswordStrength = ({ password }) => {
  const strength = !password ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const colors = ["bg-slate-200", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? colors[strength] : "bg-slate-200"}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${strength <= 1 ? "text-red-500" : strength === 2 ? "text-orange-500" : strength === 3 ? "text-yellow-600" : "text-emerald-600"}`}>
        {labels[strength]}
      </p>
    </div>
  );
};

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "", // Will store the 10-digit number
    role: "patient",
  });

  // Force light color tokens on auth pages so typed text stays readable on the
  // white card (system dark mode would otherwise flip tokens while the card
  // stays white, making input text invisible).
  useEffect(() => {
    document.documentElement.classList.add('light');
    return () => document.documentElement.classList.remove('light');
  }, []);

  // Check for pre-filled email or phone from Login page URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const preEmail = params.get('email');
    const prePhone = params.get('phone');
    if (preEmail) setFormData(prev => ({ ...prev, email: preEmail }));
    if (prePhone) setFormData(prev => ({ ...prev, phone: prePhone }));
  }, [location.search]);

  const handleChange = (e) => {
    let { name, value } = e.target;

    // Auto-strip +91 or any non-digit chars if user pastes a phone number
    if (name === "phone") {
      value = value.replace(/\D/g, ""); // Keep only digits
      if (value.startsWith("91") && value.length === 12) {
        value = value.substring(2); // Strip leading 91 if it's +91
      }
      if (value.length > 10) value = value.substring(0, 10); // Cap at 10 digits
    }

    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) errs.name = "Full name must be at least 2 characters.";
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = "Please enter a valid email address.";
    if (formData.password.length < 6) errs.password = "Password must be at least 6 characters.";
    if (formData.phone.length !== 10) errs.phone = "Please enter a valid 10-digit mobile number.";
    return errs;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    setLoading(true);
    try {
      // Auto-append +91 when sending to the server
      const formattedPhone = `+91${formData.phone}`;

      // Use Base44 Auth SDK for sign up.
      // NOTE: platform register only persists built-in fields (email/password/full_name)
      // and sets role to the platform default "user" — it ignores custom fields like `phone`
      // and the entity's role default. We set phone + role=patient via a service-role call below.
      await base44.auth.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.name
      });

      await base44.functions.invoke("completeSignup", {
        email: formData.email,
        phone: formattedPhone,
        role: "patient",
        full_name: formData.name
      });

      // Successfully created! Send them to login.
      navigate("/login");
    } catch (err) {
      const msg = err.message || "Failed to create account.";
      // Catch specific backend uniqueness errors
      if (msg.toLowerCase().includes("email already registered")) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes("phone number already registered")) {
        setErrors({ phone: msg });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-green-50 to-emerald-100 dark:bg-none dark:bg-background flex items-center justify-center p-4 pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-card dark:text-card-foreground rounded-3xl shadow-2xl overflow-hidden border dark:border-border">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-emerald-600 dark:from-emerald-900 dark:to-emerald-950 p-8 text-center text-white">
            <div className="flex justify-center mb-3">
              <div className="bg-white/20 dark:bg-card p-1 rounded-full backdrop-blur-sm shadow-inner">
                <img src="/logo.png" alt="Logo" className="h-20 w-20 rounded-full object-cover" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-white/75 text-sm mt-1">Join the Guduchi healthcare platform</p>
          </div>

          {/* Form */}
          <div className="p-8">
            {errors.form && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.form}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-foreground font-medium">Full Name</Label>
                <Input
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                <ErrorMsg msg={errors.name} />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-foreground font-medium">Email Address</Label>
                <Input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                <ErrorMsg msg={errors.email} />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-foreground font-medium">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`pr-10 ${errors.password ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={formData.password} />
                <ErrorMsg msg={errors.password} />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-foreground font-medium">Mobile Number</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-muted-foreground font-medium">
                    +91
                  </div>
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="1234567890"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`pl-12 ${errors.phone ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-muted-foreground">10-digit number. Used for Two-Factor Authentication (2FA)</p>
                <ErrorMsg msg={errors.phone} />
              </div>

              <Button type="submit" className="w-full h-12 text-base font-semibold rounded-xl gap-2 mt-2" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 dark:text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-semibold hover:underline">Log in here</Link>
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 dark:text-muted-foreground mt-4">Guduchi DRP Healthcare Platform</p>
      </div>
    </div>
  );
}