"use client"

import { useState, useEffect } from "react"
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react"
import { cva } from "class-variance-authority"
import type { Notification } from "@/lib/types"

interface NotificationAreaProps {
  notifications: Notification[]
  onRemove: (id: string) => void
}

// Create a variant system for the different notification types
const notificationVariants = cva(
  "notification flex items-start gap-3 p-4 rounded-lg shadow-md text-sm animate-in slide-in-from-right-full duration-300",
  {
    variants: {
      type: {
        success: "bg-green-50 text-green-800 border-l-4 border-green-500",
        warning: "bg-amber-50 text-amber-800 border-l-4 border-amber-500",
        error: "bg-red-50 text-red-800 border-l-4 border-red-500",
        default: "bg-blue-50 text-blue-800 border-l-4 border-blue-500",
      },
    },
    defaultVariants: {
      type: "default",
    },
  }
)

// Icon components for each notification type
const NotificationIcon = ({ type }: { type: Notification["type"] }) => {
  switch (type) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
    default:
      return <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
  }
}

export function NotificationArea({ notifications, onRemove }: NotificationAreaProps) {
  // Auto-hide notifications after they appear
  useEffect(() => {
    // No need to do anything here, the auto-remove is handled by the parent component
  }, [notifications])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={notificationVariants({ type: notification.type })}
          role="alert"
        >
          <NotificationIcon type={notification.type} />
          
          <div className="flex-1">
            <p className="font-medium">{notification.message}</p>
          </div>
          
          <button
            onClick={() => onRemove(notification.id)}
            className="flex-shrink-0 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 rounded-full p-1"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
