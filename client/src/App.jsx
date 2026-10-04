import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import IntroSplash from './components/IntroSplash.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import Search from './pages/Search.jsx';
import TitleDetail from './pages/TitleDetail.jsx';
import Watch from './pages/Watch.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Privacy from './pages/Privacy.jsx';
import NotFound from './pages/NotFound.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <AuthProvider>
      {!introDone && <IntroSplash onDone={() => setIntroDone(true)} />}
      <Navbar />
      <main className="app-main">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/search" element={<Search />} />
          <Route path="/title/:type/:id" element={<TitleDetail />} />
          <Route path="/watch/:type/:id" element={<Watch />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </main>
    </AuthProvider>
  );
}
