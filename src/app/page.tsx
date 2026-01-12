"use client";

import {  UserButton } from "@clerk/nextjs";
import { LandingNavbar } from "../components/LandingNavbar";

export default function Home() {
  return (
   <div className="flex flex-row justify-between m-auto h-[100vh] bg-slate-700 dark">
    <LandingNavbar />
    <h1>Welcome to the Home Page</h1>
    {/* <SignOutButton forcedsign className="w-auto p-2 h-auto rounded-2xl bg-blue-500 text-white active:opacity-50 hover:opacity-75"/> */}
     <UserButton />
   </div>
  );
}
