import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuthModal({
  isOpen = false,
  onClose = () => {},
  initialMode = 'login', // 'login' or 'signup'
  onSuccess = () => {}
}) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 8) {
          setErrorMessage('Password must be at least 8 characters.');
          setIsSubmitting(false);
          return;
        }
        await signup(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      onSuccess(mode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!');
      onClose();
    } catch (err) {
      setErrorMessage(
        err?.data?.detail ||
        err?.message ||
        'Authentication failed. Please check your credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-[#D8CBB6] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Ribbon */}
        <div className="bg-[#44312A] text-[#FAF7F2] px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent pointer-events-none" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#E7DDCA] hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15">
              <ShieldCheck className="h-5 w-5 text-[#E7DDCA]" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display tracking-tight text-white">
                {mode === 'signup' ? 'Join JanDrishti Civic Network' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-[#E7DDCA]/80">
                Parliamentary Oversight & Risk Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Public Access Civic Notice */}
        <div className="mx-6 mt-4 p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]/80 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[#504F47]">
            <strong className="text-[#44312A] font-semibold">Optional Identity: </strong>
            All public dashboards, maps, and statistical investigations remain completely open without logging in. Authentication establishes your identity for future civic audit logs.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex px-6 pt-4 gap-2">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'login'
                ? 'bg-[#44312A] text-[#FAF7F2] shadow-sm'
                : 'bg-[#FAF7F2] text-[#504F47] hover:text-[#44312A]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'signup'
                ? 'bg-[#44312A] text-[#FAF7F2] shadow-sm'
                : 'bg-[#FAF7F2] text-[#504F47] hover:text-[#44312A]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#44312A] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-[#8C7769]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D8CBB6] bg-white text-xs text-[#44312A] placeholder-[#8C7769]/60 focus:outline-none focus:ring-2 focus:ring-[#44312A]/30 focus:border-[#44312A] transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#44312A] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#8C7769]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investigator@domain.org"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D8CBB6] bg-white text-xs text-[#44312A] placeholder-[#8C7769]/60 focus:outline-none focus:ring-2 focus:ring-[#44312A]/30 focus:border-[#44312A] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#44312A] mb-1.5">
              Password {mode === 'signup' && <span className="text-[10px] text-[#8C7769] font-normal">(min. 8 characters)</span>}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#8C7769]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#D8CBB6] bg-white text-xs text-[#44312A] placeholder-[#8C7769]/60 focus:outline-none focus:ring-2 focus:ring-[#44312A]/30 focus:border-[#44312A] transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 text-[#8C7769] hover:text-[#44312A] transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#44312A] hover:bg-[#34241E] text-white text-xs font-bold shadow-md shadow-[#44312A]/20 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {mode === 'signup' ? 'Creating Account...' : 'Authenticating...'}
              </span>
            ) : (
              <>
                <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#FAF7F2] border-t border-[#D8CBB6]/60 text-center">
          <p className="text-[11px] text-[#504F47]">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setErrorMessage(null); }}
                  className="font-bold text-[#44312A] underline cursor-pointer"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                Need an account?{' '}
                <button
                  onClick={() => { setMode('signup'); setErrorMessage(null); }}
                  className="font-bold text-[#44312A] underline cursor-pointer"
                >
                  Create Account
                </button>
              </>
            )}
          </p>
        </div>

      </div>
    </div>
  );
}
