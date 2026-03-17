import React, { useState, useEffect } from 'react';
import { Button, Card, Alert, Spinner, List, Tag, Progress, Typography } from '@/components/ui';
import { Clock, CheckCircle, AlertCircle, BookOpen, Download } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AcademicRecordImporter({ onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);
  const [importStatus, setImportStatus] = useState('idle');
  const [importStatusMessage, setImportStatusMessage] = useState('');

  // Start the scraping process
  const startImport = async () => {
    setIsImporting(true);
    setError(null);
    setImportStatus('running');
    setImportStatusMessage('A browser window will open for MySlice. Sign in there and keep this page open while import runs.');

    try {
      const response = await fetch(`${API_BASE_URL}/api/scrape-academic-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manualLogin: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start import: ${response.statusText}`);
      }

      const data = await response.json();
      setJobId(data.jobId);
    } catch (err) {
      setError(err.message);
      setImportStatus('error');
      setImportStatusMessage(err.message || 'Import failed. Review the log below for details.');
      setIsImporting(false);
    }
  };

  // Poll for job status
  useEffect(() => {
    let intervalId;

    if (jobId && isImporting) {
      console.log("Starting polling for job:", jobId);
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/scrape-status/${jobId}`);

          if (!response.ok) {
            throw new Error(`Failed to get status: ${response.statusText}`);
          }

          const data = await response.json();
          console.log("Received status update:", data);
          setJobStatus(data);

          // If job is completed or failed, stop polling
          if (data.status === 'completed' || data.status === 'failed') {
            console.log("Job finished with status:", data.status);
            setIsImporting(false);
            clearInterval(intervalId);

            if (data.status === 'completed' && data.result) {
              const importedCourses = Array.isArray(data.result?.courses) ? data.result.courses : [];
              setCourses(importedCourses);
              setImportStatus('success');
              setImportStatusMessage(`Import successful. ${importedCourses.length} course(s) were imported from MySlice.`);
              if (onImportComplete) {
                onImportComplete(importedCourses);
              }
            } else if (data.status === 'failed') {
              setError(data.message);
              setImportStatus('error');
              setImportStatusMessage(data.message || 'Import failed. Review the log below for details.');
            }
          } else if (data.status === 'running') {
            setImportStatus('running');
            setImportStatusMessage('Import in progress. Waiting for MySlice to finish responding.');
          }
        } catch (err) {
          console.error("Polling error:", err);
          setError(err.message);
          setImportStatus('error');
          setImportStatusMessage(err.message || 'Import failed. Review the log below for details.');
          setIsImporting(false);
          clearInterval(intervalId);
        }
      }, 1000); // Poll every 1 second for more real-time updates
    }

    return () => {
      if (intervalId) {
        console.log("Cleaning up polling interval");
        clearInterval(intervalId);
      }
    };
  }, [jobId, isImporting, onImportComplete]);

  // Get the progress percentage
  const getProgressPercentage = () => {
    if (!jobStatus) return 0;

    switch (jobStatus.status) {
      case 'running':
        return 50;
      case 'completed':
        return 100;
      case 'failed':
        return 100;
      default:
        return 0;
    }
  };

  // Get status message for display
  const getStatusMessage = () => {
    if (!jobStatus) return 'Ready to import your academic record';

    if (jobStatus.status === 'running') {
      return 'Importing your academic record... This may take a minute. Please keep this page open.';
    } else if (jobStatus.status === 'completed') {
      return `Successfully imported ${courses.length} courses from your academic record.`;
    } else if (jobStatus.status === 'failed') {
      return `Import failed: ${jobStatus.message}`;
    }

    return '';
  };

  // Get status icon
  const StatusIcon = () => {
    if (!jobStatus || jobStatus.status === 'running') {
      return <Clock className="h-5 w-5 text-blue-500" />;
    } else if (jobStatus.status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (jobStatus.status === 'failed') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return null;
  };

  // Render grade badge with appropriate color
  const GradeBadge = ({ grade }) => {
    let color = 'gray';

    if (!grade || grade === 'Unknown') {
      return <Tag color="gray">N/A</Tag>;
    }

    if (grade.startsWith('A')) color = 'green';
    else if (grade.startsWith('B')) color = 'blue';
    else if (grade.startsWith('C')) color = 'yellow';
    else if (grade.startsWith('D')) color = 'orange';
    else if (grade.startsWith('F')) color = 'red';

    return <Tag color={color}>{grade}</Tag>;
  };

  return (
    <Card className="w-full max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BookOpen className="h-6 w-6 mr-2 text-primary" />
          <Typography variant="h4">Import Academic Record</Typography>
        </div>
        <Button
          onClick={startImport}
          disabled={isImporting}
          className="flex items-center"
        >
          {isImporting ? (
            <>
              <Spinner className="mr-2" size="sm" /> Importing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" /> Import from MySlice
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      <div className="mb-6 space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
          <div className="font-medium">Manual MySlice sign-in</div>
          <div>When you start import, the scraper will open its own Chrome window.</div>
          <div>Sign in to MySlice in that opened window, including 2FA, and leave it open while import continues.</div>
        </div>
        <div className="text-sm text-gray-500">
          Your MySlice credentials stay in the browser sign-in flow and are not entered into this app.
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <StatusIcon />
          <Typography variant="subtitle" className="ml-2">
            {getStatusMessage()}
          </Typography>
        </div>

        {importStatus !== 'idle' && (
          <div
            className={`mt-3 rounded-md border p-4 text-sm ${
              importStatus === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : importStatus === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="font-medium">
              {importStatus === 'success'
                ? 'Import Successful'
                : importStatus === 'error'
                ? 'Import Failed'
                : 'Import In Progress'}
            </div>
            <div className="mt-1">{importStatusMessage}</div>
          </div>
        )}

        {(isImporting || jobStatus) && (
          <>
            <Progress value={getProgressPercentage()} className="mt-2" />
            {jobStatus?.log && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <Typography variant="subtitle" className="mb-2">Import Log:</Typography>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap">{jobStatus.log}</pre>
              </div>
            )}
          </>
        )}
      </div>

      {courses.length > 0 && (
        <div>
          <Typography variant="h5" className="mb-4">
            Imported Courses ({courses.length})
          </Typography>

          <List>
            {courses.map((course, index) => (
              <List.Item key={index} className="flex justify-between items-center py-3">
                <div>
                  <Typography variant="subtitle" className="font-medium">
                    {course.code} - {course.name}
                  </Typography>
                  <div className="flex items-center mt-1">
                    <GradeBadge grade={course.grade} />
                    <Typography variant="caption" className="ml-2 text-gray-500">
                      {course.term} • {course.credits} credits
                    </Typography>
                  </div>
                </div>
              </List.Item>
            ))}
          </List>

          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setCourses([]);
                setJobStatus(null);
                setJobId(null);
              }}
              className="mr-2"
            >
              Clear
            </Button>

            <Button
              onClick={() => {
                if (onImportComplete) {
                  onImportComplete(courses);
                }
              }}
            >
              Use These Courses
            </Button>
          </div>
        </div>
      )}

      {!isImporting && !jobStatus && !courses.length && (
        <div className="text-center p-8 border border-dashed rounded-md">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <Typography variant="h6" className="mb-2">No Courses Imported Yet</Typography>
          <Typography variant="body" className="text-muted-foreground">
            Click the "Import from MySlice" button to start importing your academic record.
            You will need to login to your Syracuse University MySlice account.
          </Typography>
        </div>
      )}
    </Card>
  );
} 
