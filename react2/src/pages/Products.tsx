// src/pages/Products.tsx
const Products = () => {
  return (
    <div className="page">
      <div className="container">
        <h1>Our Products</h1>
        <div className="products-grid">
          <div className="product-card">
            <h3>Product A</h3>
            <p>Advanced solution for enterprise needs.</p>
            <button className="button">Learn More</button>
          </div>
          <div className="product-card">
            <h3>Product B</h3>
            <p>Perfect for small and medium businesses.</p>
            <button className="button">Learn More</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Products;