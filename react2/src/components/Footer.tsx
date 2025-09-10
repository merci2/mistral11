const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>MyApp</h3>
            <p>Your trusted partner for digital solutions.</p>
          </div>
          
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/about">About</a></li>
              <li><a href="/services">Services</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Contact Info</h4>
            <p>Email: info@myapp.com</p>
            <p>Phone: +49 123 456 789</p>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2024 MyApp. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;