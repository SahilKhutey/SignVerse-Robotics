import "./globals.css";

export const metadata = {
  title: "SignVerse Dashboard",
  description: "Robotics Control Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}