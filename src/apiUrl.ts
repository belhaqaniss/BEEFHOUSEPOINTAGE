const productionApi="https://51-255-37-57.nip.io/api";
const configuredApi=String(import.meta.env.VITE_API_URL||"").trim().replace(/^VITE_API_URL\s*=\s*/i,"");
export const API_URL=(configuredApi||(import.meta.env.PROD?productionApi:"/api")).replace(/\/$/,"");
export const apiUrl=(query="")=>`${API_URL}${query}`;
