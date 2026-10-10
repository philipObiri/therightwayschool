import { toast } from 'sonner';
import { showSuccessTick } from '../components/ui/SuccessTick';

export function successToast(message) {
  showSuccessTick();
  toast.success(message);
}
