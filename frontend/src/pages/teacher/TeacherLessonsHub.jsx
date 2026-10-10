import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { MGMT_ROLES } from './lessons_hub/shared';
import StaffView from './lessons_hub/StaffView';
import ManagementView from './lessons_hub/ManagementView';

export default function TeacherLessonsHub() {
  const { user } = useAuth();
  const isMgmt = MGMT_ROLES.includes(user?.role);
  const isAlsoTeacher = user?.roles?.includes('Teacher') || user?.teaching_subjects?.length > 0;
  const [viewMode, setViewMode] = React.useState(isMgmt && isAlsoTeacher ? 'staff' : (isMgmt ? 'management' : 'staff'));

  if (isMgmt && isAlsoTeacher) {
    return (
      <div>
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 px-1">
          <Button size="default" variant={viewMode === 'staff' ? 'default' : 'outline'} className="text-sm md:text-base rounded-lg h-10 md:h-11 px-4 md:px-6"
            onClick={() => setViewMode('staff')} data-testid="lesson-staff-view-btn">
            My Lessons
          </Button>
          <Button size="default" variant={viewMode === 'management' ? 'default' : 'outline'} className="text-sm md:text-base rounded-lg h-10 md:h-11 px-4 md:px-6"
            onClick={() => setViewMode('management')} data-testid="lesson-mgmt-view-btn">
            Management Review
          </Button>
        </div>
        {viewMode === 'staff' ? <StaffView /> : <ManagementView />}
      </div>
    );
  }
  return isMgmt ? <ManagementView /> : <StaffView />;
}
