import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Injectable()
export class AIChatService {
  private readonly logger = new Logger(AIChatService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async processMessage(userId: string, dto: ChatMessageDto) {
    const userMessage = dto.message.trim();
    let aiResponse = '';

    // Safety checks for emergency critical keywords
    const lower = userMessage.toLowerCase();
    const isEmergency =
      lower.includes('heart attack') ||
      lower.includes('chest pain') ||
      lower.includes('stroke') ||
      lower.includes('unconscious') ||
      lower.includes('severe bleeding') ||
      lower.includes('cannot breathe') ||
      lower.includes('ambulance');

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey && apiKey !== 'dev_gemini_api_key_placeholder') {
      try {
        // Direct call to Gemini API if valid key provided
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are CivicConnect AI, a verified civic health guidance assistant for citizens in India. 
Respond informatively, clearly, and concisely. 
Always include a clear medical disclaimer that you are an AI assistant and not a substitute for clinical medical advice.
If this is an acute emergency, instruct the user to dial 108 (Ambulance) or 112 (National Emergency) immediately.

User question: "${userMessage}"`,
                    },
                  ],
                },
              ],
            }),
          },
        );

        const data: any = await response.json();
        aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err: any) {
        this.logger.warn(`External Gemini API call failed: ${err?.message || 'Network error'}. Using intelligent offline health engine.`);
      }
    }

    if (!aiResponse) {
      aiResponse = this.generateDeterministicHealthAdvisory(userMessage, isEmergency);
    }

    // Save to user chat history
    await this.prisma.aIChatHistory.create({
      data: {
        userId,
        userMessage,
        aiResponse,
      },
    });

    return {
      message: aiResponse,
      isEmergency,
      emergencyHelplines: isEmergency
        ? [
            { name: 'National Emergency Response System', number: '112' },
            { name: 'Emergency Medical & Ambulance Transit', number: '108' },
            { name: 'Karnataka State Health Helpline', number: '104' },
            { name: 'National Blood Helpline', number: '1800-180-1104' },
          ]
        : [],
      disclaimer:
        '⚠️ Medical Disclaimer: CivicConnect AI provides informational guidance only and does not formulate clinical diagnoses. For critical or urgent medical needs, visit the nearest emergency facility or call 108.',
    };
  }

  async getChatHistory(userId: string) {
    return this.prisma.aIChatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  }

  private generateDeterministicHealthAdvisory(query: string, isEmergency: boolean): string {
    const q = query.toLowerCase();

    if (isEmergency) {
      return `🚨 **CRITICAL ADVISORY — EMERGENCY ACTION REQUIRED**
If you or someone nearby is experiencing acute chest pain, sudden numbness, breathing collapse, or severe bleeding:
1. **Immediately call 108** for Emergency Ambulance or **112** for Emergency Response.
2. Check CivicConnect's **Hospitals & Live Capacity tab** for nearby facilities with available **ICU Beds** and **24/7 Trauma Care**.
3. Keep the patient calm, resting in a comfortable position, and do not administer solid food or unprescribed medications.`;
    }

    if (q.includes('heat') || q.includes('sunstroke') || q.includes('dehydration')) {
      return `☀️ **Heatwave & Dehydration Management:**
- Stay hydrated with water, ORS (Oral Rehydration Salts), coconut water, and buttermilk.
- Avoid direct outdoor exposure between 12:00 PM and 3:30 PM.
- Seek shaded, air-conditioned areas if experiencing dizziness, nausea, or rapid pulse.
- ORS packets are widely stocked at nearby pharmacies listed on CivicConnect.`;
    }

    if (q.includes('blood') || q.includes('platelet') || q.includes('donor')) {
      return `🩸 **Blood & Platelet Availability Guidance:**
- You can search real-time blood group stock across licensed blood centres (such as Red Cross & Rotary Blood Bank) in the **Blood Banks** section.
- Healthy adults aged 18–65 weighing >45kg can donate whole blood every 90 days.
- For dengue platelet requests, look for blood banks equipped with Single Donor Apheresis (SDP).`;
    }

    if (q.includes('ayushman') || q.includes('pmjay') || q.includes('scheme') || q.includes('insurance')) {
      return `📋 **Government Health Scheme Guidance:**
- **Ayushman Bharat (PM-JAY):** Provides up to ₹5 Lakh/year cashless coverage for secondary and tertiary care per eligible family.
- **ABHA ID:** 14-digit digital health account to securely maintain and access medical records.
- Visit the **Govt Schemes** directory on CivicConnect to review detailed eligibility criteria, required KYC documents, and direct portal links.`;
    }

    return `💡 **Civic Health Advisory:**
Thank you for reaching out to CivicConnect. 
- To locate verified 24/7 hospitals with active ICU/general beds, explore the **Hospitals** map directory.
- For essential medicines at subsidized rates, check the **Pharmacies** tab or explore the Jan Aushadhi Scheme.
- In case of acute emergencies, please dial **108** immediately.`;
  }
}
