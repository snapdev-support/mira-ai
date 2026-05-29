import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { AuthProvider } from "@/auth/AuthContext";
import { UsageProvider } from "@/usage/UsageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./pwa";

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		<AuthProvider>
			<UsageProvider>
				<App />
			</UsageProvider>
		</AuthProvider>
	</ThemeProvider>
);
