import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";

function App() {

  return (
    <BrowserRouter>
      <Navigation />
      <div style={{ marginTop: "70px" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;