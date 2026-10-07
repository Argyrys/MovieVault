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
import Premium from './pages/Premium.jsx';
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
  const location = useLocation();
  const [introDone, setIntroDone] = useState(() => {
    try {
      return sessionStorage.getItem('mv_intro_seen') === '1';
    } catch {
      return false;
    }
  });

  const finishIntro = () => {
    try {
      sessionStorage.setItem('mv_intro_seen', '1');
    } catch {
      /* ignore */
    }
    setIntroDone(true);
  };

  return (
    <AuthProvider>
      {!introDone && <IntroSplash onDone={finishIntro} />}
      <Navbar />
      <main className="app-main">
        <ScrollToTop />
        <div key={location.pathname} className="page-fade">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/search" element={<Search />} />
            <Route path="/title/:type/:id" element={<TitleDetail />} />
            <Route path="/watch/:type/:id" element={<Watch />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
      </main>
    </AuthProvider>
  );
}
