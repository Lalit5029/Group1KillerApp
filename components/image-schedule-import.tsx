"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
// Add the missing import for the Plus and Trash2 icons at the top of the file
import { Camera, FileUp, Image as ImageIcon, Loader2, AlertCircle, CheckCircle, Edit, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { SelectedCourse } from "@/lib/types"
import { createWorker, PSM } from "tesseract.js"

interface ImageScheduleImportProps {
  onCoursesExtracted: (courses: SelectedCourse[]) => void
}

export function ImageScheduleImport({ onCoursesExtracted }: ImageScheduleImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extractedCourses, setExtractedCourses] = useState<SelectedCourse[]>([])
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [recognitionProgress, setRecognitionProgress] = useState(0)
  const [recognizedText, setRecognizedText] = useState<string>("")
  const [editMode, setEditMode] = useState(false)
  const { toast } = useToast()
  const workerRef = useRef<any>(null)

  // Initialize Tesseract worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        const worker = await createWorker('eng')
        workerRef.current = worker
        console.log("Tesseract worker initialized")
      } catch (error) {
        console.error("Failed to initialize Tesseract worker:", error)
        toast({
          title: "OCR initialization failed",
          description: "Could not initialize text recognition engine. Please try again later.",
          variant: "destructive",
        })
      }
    }

    initWorker()

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [toast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)

      // Create preview URL
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)

      // Reset states
      setExtractedCourses([])
      setRecognizedText("")
      setRecognitionProgress(0)
      setEditMode(false)
    }
  }

  const preprocessImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        // Set canvas size to match image
        canvas.width = img.width
        canvas.height = img.height

        // Draw image
        ctx.drawImage(img, 0, 0)

        // Convert to grayscale
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
          data[i] = avg // R
          data[i + 1] = avg // G
          data[i + 2] = avg // B
        }
        ctx.putImageData(imageData, 0, 0)

        // Apply adaptive thresholding
        const thresholdedData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const thresholded = thresholdedData.data
        const blockSize = 11
        const C = 2

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4
            let sum = 0
            let count = 0

            // Calculate local threshold
            for (let by = -blockSize / 2; by <= blockSize / 2; by++) {
              for (let bx = -blockSize / 2; bx <= blockSize / 2; bx++) {
                const nx = x + bx
                const ny = y + by
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                  const ni = (ny * canvas.width + nx) * 4
                  sum += thresholded[ni]
                  count++
                }
              }
            }

            const threshold = (sum / count) - C
            const value = thresholded[i] < threshold ? 0 : 255
            thresholded[i] = value // R
            thresholded[i + 1] = value // G
            thresholded[i + 2] = value // B
          }
        }
        ctx.putImageData(thresholdedData, 0, 0)

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        }, 'image/jpeg', 0.9)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const processImage = async () => {
    if (!file) {
      toast({
        title: "No image selected",
        description: "Please select an image first.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setRecognitionProgress(10)

    try {
      // Preprocess image
      const processedBlob = await preprocessImage(file)
      setRecognitionProgress(30)

      // Initialize Tesseract with optimized parameters
      const worker = await createWorker('eng')
      
      // Configure Tesseract for better accuracy
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:,.() ',
        tessedit_pageseg_mode: '6' as PSM, // Assume uniform block of text
        tessedit_ocr_engine_mode: 3, // Legacy + LSTM mode
        tessedit_do_invert: 0, // Don't invert image
        tessedit_do_adaptive_threshold: 1, // Use adaptive thresholding
        tessedit_do_adaptive_debug: 0, // Don't debug adaptive thresholding
      })

      const { data: { text } } = await worker.recognize(processedBlob)
      setRecognizedText(text)
      setRecognitionProgress(80)

      // Parse the text with improved course detection
      const courses = parseCoursesFromText(text)
      setExtractedCourses(courses)
      setRecognitionProgress(100)

      if (courses.length > 0) {
        toast({
          title: "Schedule extracted successfully",
          description: `Found ${courses.length} courses in your schedule.`,
        })
      } else {
        toast({
          title: "No courses found",
          description: "Could not identify any courses in the image. Try editing the text or using a clearer image.",
          variant: "destructive",
        })
        setEditMode(true)
      }

      await worker.terminate()
      setIsProcessing(false)
    } catch (error) {
      console.error("Error processing image:", error)
      toast({
        title: "Processing failed",
        description: "Failed to extract text from image. Please try again with a clearer image.",
        variant: "destructive",
      })
      setIsProcessing(false)
      setRecognitionProgress(0)
    }
  }
  
  // Enhanced course parsing with better pattern recognition
  const parseCoursesFromText = (text: string): SelectedCourse[] => {
    const courses: SelectedCourse[] = []
    let courseId = 1

    // Clean up the text
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/ \n/g, '\n')
      .replace(/\n /g, '\n')
    
    // Split the text into course sections
    const courseBlocks = cleanedText.split(/(?=\b[A-Z]{2,4}\s*\d{3}[A-Z]*\s*-)/)
    
    courseBlocks.forEach(block => {
      if (!block.trim()) return
      
      // Enhanced course code and title extraction
      const courseMatch = /([A-Z]{2,4}\s*\d{3}[A-Z]*)\s*-\s*([^\n]+)/.exec(block)
      if (!courseMatch) return
      
      const courseCode = courseMatch[1].replace(/\s+/g, ' ').trim()
      const title = courseMatch[2].trim()
      
      // Enhanced section detection
      let section = "M001" // Default
      const sectionMatch = /\b([A-Z]\d{3,4})\b/.exec(block)
      if (sectionMatch) {
        section = sectionMatch[1]
      }
      
      // Enhanced days and times detection
      let daysAndTimes = "TBA"
      const timeMatch = /((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s+(?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/.exec(block)
      if (timeMatch) {
        const days = timeMatch[1] || ""
        const startTime = timeMatch[2]
        const endTime = timeMatch[3]
        daysAndTimes = days ? `${days} ${startTime} - ${endTime}` : `${startTime} - ${endTime}`
      }
      
      // Enhanced room detection
      let room = "TBA"
      const roomMatch = /((?:Hall|Room|Building|Center|Ctr|Theater|Lab|Science|Tech|Languages)\s+[A-Za-z0-9\s&-]+\s*\d+)/.exec(block)
      if (roomMatch) {
        room = roomMatch[1]
      }
      
      // Enhanced instructor detection
      let instructor = "Not specified"
      const instructorMatch = /(?:Instructor|Professor|Prof\.?|Dr\.?|P)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/.exec(block)
      if (instructorMatch) {
        instructor = instructorMatch[1]
      }
      
      // Enhanced date detection
      let meetingDates = "01/14/2025 - 04/26/2025" // Default
      const dateMatch = /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/.exec(block)
      if (dateMatch) {
        meetingDates = `${dateMatch[1]} - ${dateMatch[2]}`
      }
      
      // Create course object
      courses.push({
        id: `course-${Date.now()}-${courseId++}`,
        Class: courseCode,
        Section: section,
        DaysTimes: daysAndTimes,
        Room: room,
        Instructor: instructor,
        MeetingDates: meetingDates,
      })
    })
    
    return courses
  }

  const handleRecognizedTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRecognizedText(e.target.value);
  }

  const parseEditedText = () => {
    if (!recognizedText.trim()) {
      toast({
        title: "No text to parse",
        description: "Please enter some text to extract courses from.",
        variant: "destructive",
      })
      return
    }

    const courses = parseCoursesFromText(recognizedText)

    if (courses.length > 0) {
      setExtractedCourses(courses)
      setEditMode(false)
      toast({
        title: "Courses extracted",
        description: `Found ${courses.length} courses in the edited text.`,
      })
    } else {
      toast({
        title: "No courses found",
        description: "Could not identify any courses in the text. Please check the format and try again.",
        variant: "destructive",
      })
    }
  }

  const handleImportCourses = () => {
    if (extractedCourses.length === 0) {
      toast({
        title: "No courses to import",
        description: "Please process an image first to extract courses.",
        variant: "destructive",
      })
      return
    }

    try {
      // Make sure each course has valid fields
      const coursesToImport = extractedCourses.map(course => ({
        id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        Class: course.Class || "Unknown Course",
        Section: course.Section || "M001",
        DaysTimes: course.DaysTimes || "TBA",
        Room: course.Room || "TBA",
        Instructor: course.Instructor || "Not specified",
        MeetingDates: course.MeetingDates || "01/14/2025 - 04/26/2025",
      }));
      
      onCoursesExtracted(coursesToImport);

      toast({
        title: "Courses imported",
        description: `Successfully added ${extractedCourses.length} courses to your schedule.`,
      })
      
      // Reset state after successful import
      setFile(null)
      setPreviewUrl(null)
      setExtractedCourses([])
      setRecognizedText("")
      setRecognitionProgress(0)
      setEditMode(false)
    } catch (error) {
      console.error("Error importing courses:", error);
      toast({
        title: "Import failed",
        description: "There was an error importing the courses. Please try again.",
        variant: "destructive",
      });
    }
  }

  const handleEditCourse = (index: number, field: keyof SelectedCourse, value: string) => {
    setExtractedCourses((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
      }
      return updated
    })
  }

  const safePrompt = (message: string, defaultValue: string): string => {
    const result = prompt(message, defaultValue || "")
    return result || defaultValue
  }

  const handleEditField = (index: number, field: keyof SelectedCourse, currentValue: string = "") => {
    const newValue = safePrompt(`Edit ${field}`, currentValue)
    handleEditCourse(index, field, newValue)
  }

  const handleAddManualCourse = () => {
    const newCourse: SelectedCourse = {
      id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      Class: "",
      Section: "M001",
      DaysTimes: "TBA",
      Room: "TBA",
      Instructor: "Not specified",
      MeetingDates: "01/14/2025 - 04/26/2025",
    }

    setExtractedCourses((prev) => [...prev, newCourse])
  }

  const handleRemoveCourse = (index: number) => {
    setExtractedCourses((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Import Schedule from Image
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
            <TabsTrigger value="camera" disabled={true}>
              Take Photo (Coming Soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="schedule-image">Upload Schedule Image</Label>
              <Input
                id="schedule-image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>

            {previewUrl && (
              <div className="mt-4 border rounded-md overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Schedule preview"
                  className="w-full object-contain max-h-[300px]"
                />
              </div>
            )}

            {isProcessing && (
              <div className="mt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Processing image...</span>
                  <span className="text-sm">{Math.round(recognitionProgress)}%</span>
                </div>
                <Progress value={recognitionProgress} className="h-2" />
              </div>
            )}

            {editMode ? (
              <div className="mt-4">
                <div className="flex justify-between mb-2">
                  <Label htmlFor="recognized-text">Edit Extracted Text</Label>
                  <Button variant="outline" size="sm" onClick={parseEditedText}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Apply Edits
                  </Button>
                </div>
                <textarea
                  id="recognized-text"
                  value={recognizedText}
                  onChange={handleRecognizedTextChange}
                  className="w-full min-h-[200px] p-2 border rounded-md font-mono text-sm"
                />
              </div>
            ) : (
              extractedCourses.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-lg font-semibold">Extracted Courses</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Text
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAddManualCourse}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Course
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {extractedCourses.map((course, index) => (
                      <div
                        key={course.id}
                        className="p-3 border rounded-md bg-white hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{course.Class || "No Course Code"}</h4>
                              <span className="text-sm text-slate-500">Section: {course.Section}</span>
                            </div>
                            <div className="text-sm mt-1">{course.DaysTimes}</div>
                            <div className="text-sm text-slate-600 mt-1">
                              Room: {course.Room} • Instructor: {course.Instructor}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditField(index, "Class", course.Class)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCourse(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="camera">
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Camera className="h-10 w-10 mb-2 text-slate-300" />
              <p>Camera functionality coming soon</p>
              <p className="text-sm mt-2">This feature will allow you to take a photo of your schedule directly.</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4 mt-4">
        <Button
          variant="outline"
          onClick={() => document.getElementById("schedule-image")?.click()}
          disabled={isProcessing}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Select Image
        </Button>

        {!extractedCourses.length ? (
          <Button 
            variant="default"
            onClick={processImage} 
            disabled={!file || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Extract Courses
              </>
            )}
          </Button>
        ) : (
          <Button 
            variant="default"
            onClick={handleImportCourses} 
            disabled={extractedCourses.length === 0}
          >
            Import {extractedCourses.length} Courses
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
