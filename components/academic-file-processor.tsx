"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, X, FileText, Calendar, CheckCircle } from "lucide-react"
import { type CourseData, processAcademicData, generateAcademicSummary } from "@/lib/academic-data"
import { useToast } from "@/hooks/use-toast"

interface AcademicFileProcessorProps {
  onDataProcessed: (data: CourseData[]) => void
}

export function AcademicFileProcessor({ onDataProcessed }: AcademicFileProcessorProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessed, setIsProcessed] = useState(false)
  const [summary, setSummary] = useState<ReturnType<typeof generateAcademicSummary> | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setIsProcessed(false) // Reset when new file is selected
      setSummary(null)
    }
  }

  const clearFile = () => {
    setFile(null)
    setIsProcessed(false)
    setSummary(null)
  }

  const processFile = () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select an academic data file first.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // Read and process the file
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string
        const processedData = processAcademicData(fileContent)

        if (processedData) {
          // Calculate summary information
          const dataSummary = generateAcademicSummary(processedData)
          setSummary(dataSummary)

          // Pass processed data to parent component
          onDataProcessed(processedData)

          setIsProcessed(true)
          toast({
            title: "File processed successfully",
            description: `Processed ${processedData.length} courses.`,
            variant: "default",
          })
        } else {
          toast({
            title: "Processing failed",
            description: "The file format is invalid or contains errors.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error processing file:", error)
        toast({
          title: "Processing error",
          description: "An error occurred while processing the file.",
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
      }
    }

    reader.onerror = () => {
      toast({
        title: "File read error",
        description: "Unable to read the selected file.",
        variant: "destructive",
      })
      setIsProcessing(false)
    }

    reader.readAsText(file)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Academic Data Processor
        </CardTitle>
        <CardDescription>Upload your academic data file to process and display it on the calendar</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="academic-file">Academic Data File</Label>
            <div className="flex items-center gap-2">
              <Input id="academic-file" type="file" accept=".json" onChange={handleFileChange} className="flex-1" />
              {file && (
                <Button variant="ghost" size="icon" onClick={clearFile} aria-label="Clear file selection">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {file && (
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-medium">Selected File:</div>
              <div className="text-slate-500">{file.name}</div>
            </div>
          )}

          {isProcessed && summary && (
            <div className="rounded-md bg-green-50 p-3 text-sm">
              <div className="font-medium flex items-center gap-1 text-green-700">
                <CheckCircle className="h-4 w-4" />
                Processing Complete
              </div>
              <div className="mt-2 space-y-1 text-slate-700">
                <div>Courses: {summary.totalCourses}</div>
                <div>Credits: {summary.totalCredits}</div>
                <div>GPA: {summary.gpa}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => document.getElementById("academic-file")?.click()}
          disabled={isProcessing}
        >
          <Upload className="mr-2 h-4 w-4" />
          Select File
        </Button>
        <Button onClick={processFile} disabled={!file || isProcessing}>
          <Calendar className="mr-2 h-4 w-4" />
          {isProcessing ? "Processing..." : "Process & Display"}
        </Button>
      </CardFooter>
    </Card>
  )
}
