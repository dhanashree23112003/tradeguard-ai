import axios from "axios";

const BASE = "http://localhost:8000/api";

export const getTransactions = () => axios.get(`${BASE}/transactions`).then(r => r.data);
export const getCases = (params = {}) => axios.get(`${BASE}/cases`, { params }).then(r => r.data);
export const getCase = (id) => axios.get(`${BASE}/cases/${id}`).then(r => r.data);
export const reviewCase = (id, action, notes) =>
  axios.patch(`${BASE}/cases/${id}/review`, { action, notes }).then(r => r.data);
export const analyzeTransaction = (id) => axios.post(`${BASE}/analyze/${id}`).then(r => r.data);
export const getPipelineStatus = (id) => axios.get(`${BASE}/pipeline/${id}`).then(r => r.data);
export const getAnalytics = () => axios.get(`${BASE}/analytics`).then(r => r.data);
