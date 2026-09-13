import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter, Link } from '../router/Router';

export default function Signup() {
  const { signup } = useAuth();
  const { navigate } = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      navigate('/');
    } catch (err) {
      setErrorMessage(
        err?.data?.detail ||
        err?.message ||
        'Could not create account. Please check your information.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-8 sm:py-12 max-w-md mx-auto animate-in fade-in duration-300">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#504F47] hover:text-[#44312A] mb-6 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Platform Overview</span>
      </Link>

      <div className="bg-white rounded-3xl border border-[#D8CBB6] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#44312A] text-[#FAF7F2] px-6 py-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/15">
              <ShieldCheck className="h-6 w-6 text-[#E7DDCA]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-white">
                Create JanDrishti Account
              </h1>
              <p className="text-xs text-[#E7DDCA]/80">
                Join Parliamentary Oversight & Investigation
              </p>
            </div>
          </div>
        </div>

        {/* Civic Notice */}
        <div className="mx-6 mt-5 p-3 rounded-2xl bg-[#FAF7F2] border border-[#D8CBB6]/80 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-[#44312A] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[#504F47]">
            <strong className="text-[#44312A] font-semibold">Public Access Notice: </strong>
            JanDrishti never restricts access. Every public dataset, map, and anomaly score can be accessed freely without an account. Account creation is optional.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

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
              Password <span className="text-[10px] text-[#8C7769] font-normal">(min. 8 characters)</span>
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
                Creating account...
              </span>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#D8CBB6]/60 text-center">
          <p className="text-xs text-[#504F47]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#44312A] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
