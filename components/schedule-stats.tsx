import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Book, GraduationCap, Clock, Building2 } from "lucide-react"
import type { SelectedCourse } from "@/lib/types"

interface ScheduleStatsProps {
  selectedCourses: SelectedCourse[]
}

export function ScheduleStats({ selectedCourses }: ScheduleStatsProps) {
  // Count total courses
  const totalCourses = selectedCourses.length

  // Estimate credit hours (most courses are 3-4 credits)
  const estimatedCredits = Math.round(totalCourses * 3.5)

  // Calculate total class hours per week
  let totalMinutes = 0
  selectedCourses.forEach((course) => {
    if (course.DaysTimes) {
      const timeMatch = course.DaysTimes.match(/(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i)
      if (timeMatch) {
        const startHour = Number.parseInt(timeMatch[1])
        const startMin = Number.parseInt(timeMatch[2])
        const startPeriod = timeMatch[3]
        const endHour = Number.parseInt(timeMatch[4])
        const endMin = Number.parseInt(timeMatch[5])
        const endPeriod = timeMatch[6]

        // Convert to 24-hour format
        let start24Hour = startHour
        if (startPeriod.toUpperCase() === "PM" && startHour !== 12) start24Hour += 12
        if (startPeriod.toUpperCase() === "AM" && startHour === 12) start24Hour = 0

        let end24Hour = endHour
        if (endPeriod.toUpperCase() === "PM" && endHour !== 12) end24Hour += 12
        if (endPeriod.toUpperCase() === "AM" && endHour === 12) end24Hour = 0

        // Calculate duration in minutes
        const startMinutes = start24Hour * 60 + startMin
        const endMinutes = end24Hour * 60 + endMin
        const duration = endMinutes - startMinutes

        // Count days
        const dayMatches = course.DaysTimes.match(/Mo|Tu|We|Th|Fr/gi) || []
        const dayCount = dayMatches.length

        // Add to total (duration * days per week)
        if (duration > 0 && dayCount > 0) {
          totalMinutes += duration * dayCount
        }
      }
    }
  })

  // Convert minutes to hours
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10 // Round to 1 decimal

  // Count unique departments
  const departments = new Set()
  selectedCourses.forEach((course) => {
    if (course.Class) {
      const deptCode = course.Class.match(/^([A-Za-z]+)/)
      if (deptCode) departments.add(deptCode[1])
    }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard icon={<Book className="h-6 w-6" />} value={totalCourses.toString()} label="Total Courses" />

      <StatCard icon={<GraduationCap className="h-6 w-6" />} value={estimatedCredits.toString()} label="Credit Hours" />

      <StatCard icon={<Clock className="h-6 w-6" />} value={totalHours.toString()} label="Class Hours" />

      <StatCard icon={<Building2 className="h-6 w-6" />} value={departments.size.toString()} label="Departments" />
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  value: string
  label: string
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <Card className="transition-all hover:translate-y-[-2px] hover:bg-gray-50">
      <CardContent className="p-4 flex items-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-4">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-semibold text-primary">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
