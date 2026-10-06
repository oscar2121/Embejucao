const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('https://brisket-pregnant-squiggly.ngrok-free.dev/health', {
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      }
    });
    console.log("Status:", res.status);
    console.log("Data:", res.data);
  } catch (e) {
    console.error("Error:", e.message);
    if (e.response) {
      console.error("Response data:", e.response.data);
    }
  }
})();
