import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../config/useAuth';
// import { appConfig } from '../config/authConfig';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout, account } = useAuth();
  const location = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = () => {
    logout();
  };

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo">
          <h1>AI in Websites</h1>
        </Link>
        
        <div className="header-right">
          <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
            <Link 
              to="/" 
              className={`nav-button ${isActivePage('/') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              to="/about" 
              className={`nav-button ${isActivePage('/about') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link 
              to="/services" 
              className={`nav-button ${isActivePage('/services') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link 
              to="/products" 
              className={`nav-button ${isActivePage('/products') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Products
            </Link>
            <Link 
              to="/blog" 
              className={`nav-button ${isActivePage('/blog') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <Link 
              to="/contact" 
              className={`nav-button ${isActivePage('/contact') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            <Link 
              to="/faq" 
              className={`nav-button ${isActivePage('/faq') ? 'nav-button-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              FAQ
            </Link>
          </nav>

          <div className="user-info">
            {account && (
              <div className="user-details">
                <span className="user-name">Welcome, {account.name || account.username}</span>
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>

          <button className="menu-toggle" onClick={toggleMenu}>
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;