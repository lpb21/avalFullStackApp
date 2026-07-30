import axios from "axios";

const api = axios.create({
  baseURL: "https://l77ui6z9f2.execute-api.us-east-1.amazonaws.com/Prod",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;