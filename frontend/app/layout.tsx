// Load the global stylesheet for the whole site
import './globals.css';
// Text shown in the browser tab
export const metadata = { title: 'Team Task Board' };
// The root layout wraps every page; "children" is the current page
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    // The page's HTML element
    <html lang="en">
      <head>
        {/* Makes the layout fit phone screens */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      {/* The visible page content goes inside body */}
      <body>{children}</body>
    </html>
  );
}
