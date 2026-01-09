
import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';

const Tasks: React.FC = () => {
  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Compliance Feed</h1>
        <p className="text-slate-400 font-semibold tracking-wide">Pending HR actions and mandatory workspace tasks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <TaskItem 
            title="Digital Policy Signature" 
            desc="Please review and sign the updated 2024 remote work policy." 
            due="Today" 
            priority="High"
          />
          <TaskItem 
            title="Annual Engagement Survey" 
            desc="Share your feedback regarding the current workspace environment." 
            due="In 3 days" 
            priority="Medium"
          />
          <TaskItem 
            title="Benefits Selection" 
            desc="Finalize your healthcare provider selection for the next fiscal year." 
            due="Next Week" 
            priority="High"
          />
          <TaskItem 
            title="Security Training Module" 
            desc="Complete the mandatory phishing awareness course." 
            due="Jun 30" 
            priority="Low"
            completed
          />
        </div>

        <div className="lg:col-span-4">
          <Card title="Task Analytics">
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">Completion Rate</span>
                  <span className="text-sm font-black text-indigo-600">85%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '85%' }}></div>
                </div>
                <div className="pt-6 grid grid-cols-2 gap-4">
                   <div className="text-center p-4 bg-emerald-50 rounded-2xl">
                     <p className="text-xs font-black text-emerald-700 uppercase mb-1">Done</p>
                     <p className="text-2xl font-black text-emerald-900">12</p>
                   </div>
                   <div className="text-center p-4 bg-rose-50 rounded-2xl">
                     <p className="text-xs font-black text-rose-700 uppercase mb-1">Open</p>
                     <p className="text-2xl font-black text-rose-900">3</p>
                   </div>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const TaskItem = ({ title, desc, due, priority, completed = false }: any) => (
  <div className={`p-6 rounded-[2rem] border transition-all flex items-start space-x-6 ${completed ? 'bg-slate-50/50 border-slate-100 grayscale opacity-60' : 'bg-white border-white shadow-sm hover:shadow-xl hover:shadow-indigo-50/50'}`}>
    <button className={`mt-1 transition-colors ${completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
      {completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
    </button>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <h4 className={`text-lg font-black ${completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>{title}</h4>
        {!completed && (
          <div className={`flex items-center text-[10px] font-black uppercase px-3 py-1 rounded-full ${priority === 'High' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
            <AlertTriangle size={10} className="mr-1" /> {priority} Priority
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed">{desc}</p>
      <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <Clock size={12} className="mr-1" /> Due {due}
      </div>
    </div>
  </div>
);

export default Tasks;
