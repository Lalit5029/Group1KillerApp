"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Loader2, CalendarClock, BookOpen } from "lucide-react"
import type { Requirements } from "@/lib/types"

interface InitialSelectionModalProps {
  requirements: Requirements
  isDataReady: boolean
  onConfirm: (major: string, year: string) => void
}

export function InitialSelectionModal({ requirements, isDataReady, onConfirm }: InitialSelectionModalProps) {
  const [selectedMajor, setSelectedMajor] = useState<string>("")
  const [selectedYear, setSelectedYear] = useState<string>("Freshman")
  const [availableMajors, setAvailableMajors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    if (isDataReady) {
      const majors = Object.keys(requirements);
      console.log("Available majors for selection:", majors);
      setAvailableMajors(majors);
      
      // Select first major by default for better UX
      if (majors.length > 0) {
        setSelectedMajor(majors[0]);
      }
      
      setIsLoading(false);
    }
  }, [isDataReady, requirements])

  const handleConfirm = () => {
    if (selectedMajor && selectedYear) {
      console.log("Confirming selection:", selectedMajor, selectedYear);
      
      // Store selection in localStorage for persistence
      localStorage.setItem("selectedMajor", selectedMajor);
      localStorage.setItem("selectedYear", selectedYear);
      
      onConfirm(selectedMajor, selectedYear)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl animate-in fade-in zoom-in duration-300">
        <CardHeader className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-primary">
            <GraduationCap className="h-5 w-5" />
            Select Your Major and Year
          </CardTitle>
          <CardDescription>Choose your engineering major and academic year to get started</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-center text-muted-foreground">Loading majors...</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="major-select" className="text-sm font-medium flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Major
                </label>
                <Select
                  value={selectedMajor}
                  onValueChange={setSelectedMajor}
                  disabled={availableMajors.length === 0}
                >
                  <SelectTrigger id="major-select" className="w-full">
                    <SelectValue placeholder="Select a major" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMajors.map((major) => (
                      <SelectItem key={major} value={major}>
                        {major}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="year-select" className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Year
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year-select" className="w-full">
                    <SelectValue placeholder="Select your year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Freshman">Freshman</SelectItem>
                    <SelectItem value="Sophomore">Sophomore</SelectItem>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-end border-t p-4 bg-gray-50/50">
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !selectedMajor || !selectedYear}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            Confirm Selection
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
