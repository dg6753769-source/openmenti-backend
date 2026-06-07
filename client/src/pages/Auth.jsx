import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Auth({ mode = "login" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: params.get("role") || "fan",
  });
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const user = await register(form.name, form.email, form.password, form.role);
        toast.success(`Welcome, ${user.name}!`);
        navigate(user.role === "artist" ? "/setup" : "/discover");
      } else {
        const user = await login(form.email, form.password);
        toast.success(`Welcome back!`);
        navigate(user.role === "artist" ? "/dashboard" : "/discover");
      }
    } catch (err) {
      toast.error(err || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8">
          <span className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            OpenMenti
          </span>
        </Link>

        <div className="bg-gray-900 rounded-2xl p-8 border border-white/10">
          <h2 className="text-xl font-bold mb-6 text-center">
            {isRegister ? "Create your account" : "Sign in"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  {["fan", "artist"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm({ ...form, role })}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors capitalize ${
                        form.role === role
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "border-white/20 text-gray-400 hover:border-white/40"
                      }`}
                    >
                      {role === "artist" ? "🎵 Artist" : "👤 Fan"}
                    </button>
                  ))}
                </div>
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all"
            >
              {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            {isRegister ? (
              <>Already have an account? <Link to="/login" className="text-purple-400 hover:text-purple-300">Sign in</Link></>
            ) : (
              <>New here? <Link to="/register" className="text-purple-400 hover:text-purple-300">Create account</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
