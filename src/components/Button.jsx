export default function Button({ children, onClick, type = "button" }) {
  return (
    <button className="btn-primary" type={type} onClick={onClick}>
      {children}
    </button>
  );
}
