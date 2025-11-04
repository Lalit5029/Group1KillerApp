'use client';

import { useState, useEffect } from 'react'
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import CourseScheduler from "@/components/course-scheduler"
import { Button } from '@/components/ui/button'
import { BookUser, LogIn, UserPlus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import type { SelectedCourse, CourseData } from '@/lib/types'

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([])
  const [courseData, setCourseData] = useState<CourseData[]>([])

  // Load saved courses when component mounts
  useEffect(() => {
    const loadSavedCourses = async () => {
      try {
        const response = await fetch('/api/courses')
        if (response.ok) {
          const savedCourses = await response.json()
          setSelectedCourses(savedCourses)
          
          // Convert SelectedCourse to CourseData
          const convertedCourses: CourseData[] = savedCourses.map((course: SelectedCourse) => ({
            course: course.Class,
            title: course.Class, // Using Class as title for now
            grade: course.grade || "IP",
            credits: course.credits || "0",
            term: "Fall 2024", // Default term
            catalogGroup: course.requirementGroup || "General", // Default catalog group
            requirementGroup: course.requirementGroup || null,
            status: "In Progress"
          }))
          
          setCourseData(convertedCourses)
        }
      } catch (error) {
        console.error("Failed to load saved courses:", error)
      }
    }

    loadSavedCourses()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut({ 
        redirect: true,
        callbackUrl: '/'
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const DegreeRequirements = () => {
    const [requirements, setRequirements] = useState({
      generalEducation: {
        title: "General Education",
        credits: 0,
        required: 0,
        completed: 0,
        remaining: 0,
        courses: [],
        progress: 0,
        status: ""
      },
      majorRequirements: {
        title: "Major Requirements",
        credits: 0,
        required: 0,
        completed: 0,
        remaining: 0,
        courses: [],
        progress: 0,
        status: ""
      },
      electives: {
        title: "Electives",
        credits: 0,
        required: 0,
        completed: 0,
        remaining: 0,
        courses: [],
        progress: 0,
        status: ""
      },
      overall: {
        totalCredits: 0,
        requiredCredits: 0,
        completedCredits: 0,
        remainingCredits: 0,
        gpa: 0,
        progress: 0,
        status: ""
      }
    });

    useEffect(() => {
      const fetchRequirements = async () => {
        try {
          const response = await fetch("/api/scrape");
          if (!response.ok) {
            throw new Error('Failed to fetch requirements');
          }
          const data = await response.json();
          console.log('Fetched data:', data);
          setRequirements(data);
        } catch (error) {
          console.error('Error fetching requirements:', error);
        }
      };

      fetchRequirements();
    }, []);

    const renderCourseList = (courses) => (
      <div className="mt-2 space-y-1">
        {courses.map((course, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="font-medium">{course.code}</span>
            <span className="text-gray-600">{course.title}</span>
            <span className="text-gray-500">{course.credits} credits</span>
            <span className={`px-2 py-1 rounded text-xs ${
              course.status === "Completed" ? "bg-green-100 text-green-800" :
              course.status === "In Progress" ? "bg-blue-100 text-blue-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {course.status}
            </span>
            {course.grade && (
              <span className="font-medium">{course.grade}</span>
            )}
          </div>
        ))}
      </div>
    );

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Degree Requirements</h2>
        
        {/* Overall Progress */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Overall Progress</h3>
            <span className="text-sm text-gray-600">GPA: {requirements.overall.gpa}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span>Total Credits: {requirements.overall.completedCredits}/{requirements.overall.requiredCredits}</span>
            <span>Remaining: {requirements.overall.remainingCredits}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${requirements.overall.progress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Status: <span className="font-medium">{requirements.overall.status}</span>
          </div>
        </div>

        {/* General Education */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{requirements.generalEducation.title}</h3>
          <div className="flex justify-between text-sm mb-2">
            <span>Credits: {requirements.generalEducation.completed}/{requirements.generalEducation.required}</span>
            <span>Remaining: {requirements.generalEducation.remaining}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-green-600 h-2.5 rounded-full"
              style={{ width: `${requirements.generalEducation.progress}%` }}
            ></div>
          </div>
          {renderCourseList(requirements.generalEducation.courses)}
        </div>

        {/* Major Requirements */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{requirements.majorRequirements.title}</h3>
          <div className="flex justify-between text-sm mb-2">
            <span>Credits: {requirements.majorRequirements.completed}/{requirements.majorRequirements.required}</span>
            <span>Remaining: {requirements.majorRequirements.remaining}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-purple-600 h-2.5 rounded-full"
              style={{ width: `${requirements.majorRequirements.progress}%` }}
            ></div>
          </div>
          {renderCourseList(requirements.majorRequirements.courses)}
        </div>

        {/* Electives */}
        <div>
          <h3 className="text-lg font-semibold mb-2">{requirements.electives.title}</h3>
          <div className="flex justify-between text-sm mb-2">
            <span>Credits: {requirements.electives.completed}/{requirements.electives.required}</span>
            <span>Remaining: {requirements.electives.remaining}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-yellow-600 h-2.5 rounded-full"
              style={{ width: `${requirements.electives.progress}%` }}
            ></div>
          </div>
          {renderCourseList(requirements.electives.courses)}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <nav className="bg-white shadow-sm mb-8 rounded-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">Course Scheduler</h1>
              </div>
            </div>
            <div className="flex items-center ml-auto">
              {status === 'authenticated' && session?.user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-gray-900">
                      {session.user.name || 'User'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {session.user.email}
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                    {session.user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link
                    href="/login"
                    className="flex items-center text-indigo-600 hover:text-indigo-800 px-4 py-2 rounded-md text-sm font-medium border border-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Academic Progress Section */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md border border-gray-200 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Explore Academic Progress</h2>
            <p className="text-gray-600">
              View degree requirements, track your progress, and see how courses fit into your plan using sample student data.
            </p>
          </div>
          <Link href="/academic-progress" passHref>
            <Button className="mt-4 md:mt-0">
              <BookUser className="mr-2 h-4 w-4" />
              View Sample Progress
            </Button>
          </Link>
        </div>


        {/* Course Scheduler Section */}
        <CourseScheduler />
      </div>
    </main>
  )
}
