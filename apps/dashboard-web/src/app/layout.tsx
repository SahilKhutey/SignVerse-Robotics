import "./globals.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export const metadata = {
  title: "SignVerse Robotics OS",
  description: "Mission Control Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground h-screen w-screen overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
