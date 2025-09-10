// src/pages/Services.tsx
const Services = () => {
  return (
    <div className="page">
      <div className="container">
        <h1>Our Services</h1>
        <div className="services-list">
          <div className="service-item">
            <h3>Web Development</h3>
            <p>Modern, responsive websites and web applications.</p>
          </div>
          <div className="service-item">
            <h3>Mobile Apps</h3>
            <p>Native and cross-platform mobile applications.</p>
          </div>
          <div className="service-item">
            <h3>Consulting</h3>
            <p>Strategic technology consulting and planning.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;