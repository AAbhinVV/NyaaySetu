"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {

  return (
    <div className="flex flex-col h-100">
      <div className="m-auto">
        <SignIn

        />
      </div>
    </div>
  );

}