"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

export function NavLinks() {
  const pathname = usePathname()

  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2">
      <Link
        href="/"
        className={`px-3 py-1 rounded-md text-sm ${
          pathname === "/" ? "bg-turquoise-500 text-black" : "bg-zinc-800 text-white hover:bg-zinc-700"
        }`}
      >
        Main Chat
      </Link>
      <Link
        href="/test"
        className={`px-3 py-1 rounded-md text-sm ${
          pathname === "/test" ? "bg-turquoise-500 text-black" : "bg-zinc-800 text-white hover:bg-zinc-700"
        }`}
      >
        Test Chat
      </Link>
    </div>
  )
}
