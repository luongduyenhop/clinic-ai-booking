import { useState } from 'react'
import HomeHero from '../../components/user/home/HomeHero'
import DoctorSection from '../../components/user/home/DoctorSection'
import SpecialtySection from '../../components/user/home/SpecialtySection'
import ClinicIntroSection from '../../components/user/home/ClinicIntroSection'
import OutpatientCareGuideSection from '../../components/user/home/OutpatientCareGuideSection'
import { getDefaultScheduleDate } from '../../utils/helpers/quickBookingHelpers'

export default function HomePage() {
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('')
    const [selectedDate, setSelectedDate] = useState(() => getDefaultScheduleDate())

    return (
        <div>
            <HomeHero
                selectedSpecialtyId={selectedSpecialtyId}
                onSpecialtySelect={setSelectedSpecialtyId}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
            />
            <DoctorSection
                embedded
                selectedSpecialtyId={selectedSpecialtyId}
                onSpecialtySelect={setSelectedSpecialtyId}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
            />
            <SpecialtySection />
            <ClinicIntroSection />
            <OutpatientCareGuideSection />
        </div>
    )
}
