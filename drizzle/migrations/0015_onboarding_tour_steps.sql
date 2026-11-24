CREATE TABLE public.tour_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key text NOT NULL UNIQUE,
  target_id text NOT NULL,
  page text NOT NULL,
  page_label text NOT NULL,
  default_title text NOT NULL,
  default_body text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sort_order int NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.tour_steps TO authenticated;
GRANT ALL ON public.tour_steps TO service_role;
ALTER TABLE public.tour_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tour" ON public.tour_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner edits tour" ON public.tour_steps FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.tour_steps_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.step_key := OLD.step_key; NEW.target_id := OLD.target_id; NEW.page := OLD.page;
  NEW.default_title := OLD.default_title; NEW.default_body := OLD.default_body;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER tour_steps_guard BEFORE UPDATE ON public.tour_steps FOR EACH ROW EXECUTE FUNCTION public.tour_steps_guard();

INSERT INTO public.tour_steps (step_key,target_id,page,page_label,default_title,default_body,title,body,sort_order) VALUES
('library','curriculum-nav','/curriculum','المكتبة','أهلاً بك في نوابغ! 🌟','هنا تبدأ رحلتك التعليمية! في المكتبة ستجد المواد الدراسية الخاصة بصفك، ويمكنك اختيار المادة التي تريد مذاكرتها والبدء في التعلم.','أهلاً بك في نوابغ! 🌟','هنا تبدأ رحلتك التعليمية! في المكتبة ستجد المواد الدراسية الخاصة بصفك، ويمكنك اختيار المادة التي تريد مذاكرتها والبدء في التعلم.',1),
('quizzes','quizzes-nav','/quizzes','اختباراتي','اختباراتك في مكان واحد! 📝','هنا تجد اختباراتك! يمكنك الوصول إلى اختباراتك، ومتابعة نتائجك، والتدرب على أسئلة المواد الدراسية.','اختباراتك في مكان واحد! 📝','هنا تجد اختباراتك! يمكنك الوصول إلى اختباراتك، ومتابعة نتائجك، والتدرب على أسئلة المواد الدراسية.',2),
('progress','streak-nav','/streak','التقدم','تابع رحلتك وإنجازك! 📊','من هنا يمكنك متابعة الأيام التي أنجزت فيها دراستك، ومشاهدة سجل نشاطك والستريك، والتعرف على تطور التزامك بالدراسة مع الوقت.','تابع رحلتك وإنجازك! 📊','من هنا يمكنك متابعة الأيام التي أنجزت فيها دراستك، ومشاهدة سجل نشاطك والستريك، والتعرف على تطور التزامك بالدراسة مع الوقت.',3),
('profile','profile-nav','/profile','حسابي','حسابك الشخصي! 👤','هنا يمكنك الاطلاع على بيانات حسابك، وإدارة إعداداتك الشخصية، وتعديل معلوماتك عند الحاجة، وإعادة مشاهدة الجولة التعريفية.','حسابك الشخصي! 👤','هنا يمكنك الاطلاع على بيانات حسابك، وإدارة إعداداتك الشخصية، وتعديل معلوماتك عند الحاجة، وإعادة مشاهدة الجولة التعريفية.',4),
('choose_subject','library-subject-first','/curriculum','المكتبة · بطاقة المادة','ابدأ رحلتك التعليمية! 📚','اختر المادة التي تريد دراستها من المكتبة، ثم افتح الدرس الذي ترغب فيه لتبدأ التعلم. ستجد داخل كل درس أدوات تساعدك على الفهم والمراجعة.','ابدأ رحلتك التعليمية! 📚','اختر المادة التي تريد دراستها من المكتبة، ثم افتح الدرس الذي ترغب فيه لتبدأ التعلم. ستجد داخل كل درس أدوات تساعدك على الفهم والمراجعة.',5),
('choose_lesson','subject-lesson-first','subject','صفحة المادة · الدرس','اختر درسك 📖','داخل صفحة المادة تجد الوحدات ودروسها بالترتيب. اضغط على الدرس لفتح صفحته والبدء في المذاكرة.','اختر درسك 📖','داخل صفحة المادة تجد الوحدات ودروسها بالترتيب. اضغط على الدرس لفتح صفحته والبدء في المذاكرة.',6),
('lesson_explain','lesson-tab-explain','lesson','صفحة الدرس · الشرح','شرح الدرس 💡','هنا يمكنك قراءة شرح الدرس وفهم المعلومات والأفكار الأساسية بطريقة منظمة وواضحة.','شرح الدرس 💡','هنا يمكنك قراءة شرح الدرس وفهم المعلومات والأفكار الأساسية بطريقة منظمة وواضحة.',7),
('lesson_cards','lesson-tab-cards','lesson','صفحة الدرس · البطاقات','راجع باستخدام البطاقات! 🧠','استخدم البطاقات التعليمية لمراجعة المعلومات وتذكر أهم النقاط بطريقة تفاعلية تساعدك على تثبيت المعلومات.','راجع باستخدام البطاقات! 🧠','استخدم البطاقات التعليمية لمراجعة المعلومات وتذكر أهم النقاط بطريقة تفاعلية تساعدك على تثبيت المعلومات.',8),
('lesson_summary','lesson-tab-summary','lesson','صفحة الدرس · الملخص','ملخص الدرس ✨','هنا تجد ملخص الدرس وأهم النقاط التي تحتاج إلى مراجعتها بسرعة قبل الاختبار.','ملخص الدرس ✨','هنا تجد ملخص الدرس وأهم النقاط التي تحتاج إلى مراجعتها بسرعة قبل الاختبار.',9),
('lesson_quiz','lesson-tab-quiz','lesson','صفحة الدرس · الاختبار','اختبر فهمك! 📝','ابدأ اختبار الدرس وأجب عن الأسئلة لتراجع معلوماتك وتتأكد من فهمك لما تعلمته.','اختبر فهمك! 📝','ابدأ اختبار الدرس وأجب عن الأسئلة لتراجع معلوماتك وتتأكد من فهمك لما تعلمته.',10),
('lesson_complete','lesson-complete','lesson','صفحة الدرس · زر الإكمال','لا تنسَ تسجيل إنجازك! 🎯','بعد الانتهاء من دراسة الدرس ومراجعته، اضغط على زر «ضع علامة مكتمل» حتى يتم تسجيل الدرس ضمن الدروس التي أنجزتها، ويُحتسب ضمن تقدمك الدراسي.','لا تنسَ تسجيل إنجازك! 🎯','بعد الانتهاء من دراسة الدرس ومراجعته، اضغط على زر «ضع علامة مكتمل» حتى يتم تسجيل الدرس ضمن الدروس التي أنجزتها، ويُحتسب ضمن تقدمك الدراسي.',11),
('start_exam','quiz-carousel','/quizzes','اختباراتي · بطاقات المواد','حان وقت اختبار معلوماتك! 🚀','يمكنك الدخول إلى صفحة اختباراتي، واختيار الاختبار الذي تريد خوضه، ثم الضغط على «بدء الاختبار» لتبدأ الإجابة عن الأسئلة.','حان وقت اختبار معلوماتك! 🚀','يمكنك الدخول إلى صفحة اختباراتي، واختيار الاختبار الذي تريد خوضه، ثم الضغط على «بدء الاختبار» لتبدأ الإجابة عن الأسئلة.',12);