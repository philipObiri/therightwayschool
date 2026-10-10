import React, { useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AlertTriangle, Search, User, X, Siren } from 'lucide-react';

export default function EmergencyPanel() {
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const searchStudents = async (q) => {
    setStudentSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const r = await api.get(`/sick-bay/students/search?q=${encodeURIComponent(q)}`);
    setSearchResults(r.data);
  };

  const handleEmergency = async () => {
    setSending(true);
    try {
      await api.post('/sick-bay/emergency', {
        student_id: selectedStudent?.user_id || '',
        student_name: selectedStudent?.name || 'Unknown',
        description: description || 'EMERGENCY in Sick Bay',
      });
      successToast('Emergency alert sent to all management');
      setSent(true);
    } catch (e) {
      toast.error('Failed to send alert');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="emergency-sent">
        <Card className="rounded-2xl border-green-200 max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Siren className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-[#1B2A4A]">Emergency Alert Sent</h2>
            <p className="text-sm text-slate-500">All administrators, principals, and management have been notified immediately.</p>
            <Button onClick={() => { setSent(false); setSelectedStudent(null); setDescription(''); }} variant="outline" className="mt-4" data-testid="send-another-btn">
              Send Another Alert
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]" data-testid="emergency-panel">
      <Card className="rounded-2xl border-red-200 max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-700">Emergency Alert</CardTitle>
          <p className="text-sm text-slate-500 mt-1">This will immediately notify all management staff</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Student (optional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search student..."
                value={studentSearch}
                onChange={e => searchStudents(e.target.value)}
                className="pl-9"
                data-testid="emergency-student-search"
              />
            </div>
            {searchResults.length > 0 && !selectedStudent && (
              <div className="border rounded-lg max-h-32 overflow-y-auto">
                {searchResults.map(s => (
                  <div key={s.user_id} onClick={() => { setSelectedStudent(s); setSearchResults([]); setStudentSearch(s.name); }}
                    className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm" data-testid={`emg-search-${s.user_id}`}>
                    {s.name} <span className="text-slate-400">({s.year_group})</span>
                  </div>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-sm">
                <User className="w-4 h-4 text-red-600" />
                <span className="font-medium">{selectedStudent.name}</span>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="ml-auto h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the emergency..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              data-testid="emergency-description"
            />
          </div>
          <Button
            onClick={handleEmergency}
            disabled={sending}
            className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-semibold"
            data-testid="send-emergency-btn"
          >
            <Siren className="w-5 h-5 mr-2" />
            {sending ? 'Sending...' : 'SEND EMERGENCY ALERT'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
