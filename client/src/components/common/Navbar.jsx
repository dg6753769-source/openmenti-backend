import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          OpenMenti
        </span>
        <span className="text-xs text-gray-500 font-medium hidden sm:block">for artists</span>
      </Link>

      <div className="flex items-center gap-5">
        <Link to="/discover" className="text-gray-400 hover:text-white transition-colors text-sm">
          Discover
        </Link>

        {user ? (
          <>
            {user.role === "artist" ? (
              <>
                <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Dashboard
                </Link>
                <Link to="/setup" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Profile
                </Link>
              </>
            ) : (
              <Link to="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">
                My Library
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-400 hover:text-white transition-colors text-sm">
              Sign in
            </Link>
            <Link
              to="/register"
              className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-full transition-colors"
            >
              Join free
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
