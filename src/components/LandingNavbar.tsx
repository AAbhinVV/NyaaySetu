"use client";
import React from "react";
import {  Menu, MenuItem  } from "./ui/navbar-menu";
import { cn } from "@/lib/utils";

export function LandingNavbar() {
  return (
    <div className="relative w-full flex items-center justify-center">
      <Navbar className="top-2" />
    </div>
  );
}

function Navbar({ className }: { className?: string }) {
  
  return (
    <div
      className={cn("fixed top-10 inset-x-0 max-w-2xl mx-auto z-50", className)}
    >
      <Menu>
        <MenuItem  item="Services" />
        <MenuItem  item="Products" />
        <MenuItem  item="Pricing" />
      </Menu>
    </div>
  );
}
