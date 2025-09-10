// src/pages/Contact.tsx
const Contact = () => {
  return (
    <div className="page">
      <div className="container">
        <h1>Contact Us</h1>
        <div className="contact-content">
          <div className="contact-info">
            <h3>Get in Touch</h3>
            <p>Email: info@myapp.com</p>
            <p>Phone: +49 123 456 789</p>
            <p>Address: Berlin, Germany</p>
          </div>
          <form className="contact-form">
            <input type="text" placeholder="Your Name" className="form-input" />
            <input type="email" placeholder="Your Email" className="form-input" />
            <textarea placeholder="Your Message" className="form-textarea"></textarea>
            <button type="submit" className="button">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;