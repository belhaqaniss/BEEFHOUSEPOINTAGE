export const API_URL=(import.meta.env.VITE_API_URL||"/api").replace(/\/$/,"");
export const apiUrl=(query="")=>`${API_URL}${query}`;
