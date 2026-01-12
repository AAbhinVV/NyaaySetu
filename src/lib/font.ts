import { Inter, IBM_Plex_Serif } from "next/font/google";

export const inter = Inter({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin", "latin-ext", "vietnamese"]
}); 
/*
card Titles: 600
body text: 400
label: 500
Buttons: 600
Navbar: 600
*/


export const ibmPlexSerif = IBM_Plex_Serif({
    weight: ["600", "700"],
    subsets: ["latin", "latin-ext", "vietnamese"]
}); 
/*
hero headline: 700
Section titles: 600
Legal Headings: 600
*/