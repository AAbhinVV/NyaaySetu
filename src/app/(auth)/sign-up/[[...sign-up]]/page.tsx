"use client";

import { SignUp } from "@clerk/nextjs";



export default function SignUpPage() {
  return (
    <div className="flex flex-col h-100">
      <div className="m-auto">
        <SignUp />
      </div>
    </div>
  );
}