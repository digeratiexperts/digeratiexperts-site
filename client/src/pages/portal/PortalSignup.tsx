import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, Lock, User, ArrowRight, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';

export default function PortalSignup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [, navigate] = useLocation();

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!email || !username || !password || !confirmPassword) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters with 1 uppercase letter and 1 number");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Signup failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/portal/login");
      }, 2000);
    } catch (err) {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030228] to-[#0f0d2e] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-white/10 border-white/20 backdrop-blur">
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Account Created Successfully!</h2>
              <p className="text-gray-300 text-sm mb-4">
                Your portal account has been created. Redirecting to login...
              </p>
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-white rounded-full mx-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030228] to-[#0f0d2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={DE_LOGO_REVERSE}
            alt="Digerati Experts"
            className="h-10 w-auto"
          />
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-white">Create Portal Account</CardTitle>
            <CardDescription className="text-gray-300">
              Sign up to access the client portal
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="your@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    required
                    data-testid="input-password"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Min 8 characters, 1 uppercase, 1 number
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D3126A] hover:bg-[#D3126A]/90 text-white font-semibold"
                data-testid="button-signup"
              >
                {loading ? "Creating Account..." : "Sign Up"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-gray-400 text-center">
                Already have an account?{" "}
                <a href="/portal/login" className="text-de-magenta-ink hover:underline">
                  Sign In
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
