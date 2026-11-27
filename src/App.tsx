
function App() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f0fdf4",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{
        color: "#16a34a",
        fontSize: "48px"
      }}>
        TutorHub
      </h1>

      <h2>Welcome to TutorHub!</h2>

      <p>
        Your learning journey starts here.
      </p>

      <button style={{
        backgroundColor: "#16a34a",
        color: "white",
        border: "none",
        borderRadius: "10px",
        padding: "12px 24px",
        cursor: "pointer"
      }}>
        Start Learning
      </button>
    </div>
  );
}

export default App;