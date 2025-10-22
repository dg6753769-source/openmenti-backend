import { Link } from "react-router-dom";

export default function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Welcome to OpenMenti</h1>
      <div className="space-x-4">
        <Link to="/host" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Host</Link>
        <Link to="/join" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Join</Link>
      </div>
    </div>
  );
}
