import type { AppLocale } from '@churchflow/shared';
import { formatDateTime } from '../../common/time/date-time';

const EMAIL_TIME_ZONE = 'Europe/Kyiv';

interface EmailMessageCatalog {
  intlLocale: string;
  emailSignIn: {
    code: (params: { code: string }) => string;
    expiresAt: (params: { expiresAt: string }) => string;
    intro: string;
    signIn: (params: { url: string }) => string;
    subject: string;
  };
  emailVerification: {
    confirm: (params: { url: string }) => string;
    expiresAt: (params: { expiresAt: string }) => string;
    intro: string;
    subject: string;
  };
  membershipClaim: {
    intro: (params: { organizationName: string }) => string;
    expiresAt: (params: { expiresAt: string }) => string;
    requestAccess: (params: { url: string }) => string;
    subject: (params: { organizationName: string }) => string;
  };
  notification: {
    open: (params: { url: string }) => string;
    subject: (params: { organizationName: string; title: string }) => string;
  };
  organizationInvitation: {
    accept: (params: { url: string }) => string;
    expiresAt: (params: { expiresAt: string }) => string;
    intro: (params: { organizationName: string; role: string }) => string;
    subject: (params: { organizationName: string }) => string;
  };
  organizationRequestAdmin: {
    labels: {
      contact: string;
      message: string;
      organization: string;
      phone: string;
      review: string;
      telegramId: string;
      telegramUsername: string;
    };
    subject: (params: { organizationName: string }) => string;
  };
  organizationRequestApproved: {
    approved: (params: { organizationName: string }) => string;
    openDashboard: (params: { url: string }) => string;
    owner: string;
    subject: (params: { organizationName: string }) => string;
  };
  organizationRequestRejected: {
    reason: (params: { rejectionReason: string }) => string;
    rejected: (params: { organizationName: string }) => string;
    subject: (params: { organizationName: string }) => string;
  };
}

const EMAIL_MESSAGE_CATALOG = {
  en: {
    intlLocale: 'en-US',
    emailSignIn: {
      code: (params) => `Or enter this code on the sign-in page: ${params.code}`,
      expiresAt: (params) => `This link and code expire at ${params.expiresAt}.`,
      intro: 'Use this link to sign in to ChurchFlow.',
      signIn: (params) => `Sign in: ${params.url}`,
      subject: 'Your ChurchFlow sign-in link',
    },
    emailVerification: {
      confirm: (params) => `Confirm your email address: ${params.url}`,
      expiresAt: (params) => `This link expires at ${params.expiresAt}.`,
      intro: 'Confirm this email address so you can use it to sign in to ChurchFlow.',
      subject: 'Confirm your ChurchFlow email address',
    },
    membershipClaim: {
      intro: (params) =>
        `An organization administrator prepared ChurchFlow access for ${params.organizationName}.`,
      expiresAt: (params) => `This link expires at ${params.expiresAt}.`,
      requestAccess: (params) => `Request access: ${params.url}`,
      subject: (params) => `Connect your ChurchFlow access for ${params.organizationName}`,
    },
    notification: {
      open: (params) => `Open: ${params.url}`,
      subject: (params) => `[${params.organizationName}] ${params.title}`,
    },
    organizationInvitation: {
      accept: (params) => `Accept invitation: ${params.url}`,
      expiresAt: (params) => `This invitation expires at ${params.expiresAt}.`,
      intro: (params) => `You are invited to join ${params.organizationName} as ${params.role}.`,
      subject: (params) => `You are invited to join ${params.organizationName}`,
    },
    organizationRequestAdmin: {
      labels: {
        contact: 'Contact',
        message: 'Message',
        organization: 'Organization',
        phone: 'Phone',
        review: 'Review',
        telegramId: 'Telegram ID',
        telegramUsername: 'Telegram username',
      },
      subject: (params) => `New organization request: ${params.organizationName}`,
    },
    organizationRequestApproved: {
      approved: (params) => `Your organization ${params.organizationName} has been approved.`,
      openDashboard: (params) => `Open dashboard: ${params.url}`,
      owner: 'You are its owner.',
      subject: (params) => `Your ChurchFlow organization is ready: ${params.organizationName}`,
    },
    organizationRequestRejected: {
      reason: (params) => `Reason: ${params.rejectionReason}`,
      rejected: (params) =>
        `Your organization request for ${params.organizationName} was rejected.`,
      subject: (params) => `Organization request update: ${params.organizationName}`,
    },
  },
  uk: {
    intlLocale: 'uk-UA',
    emailSignIn: {
      code: (params) => `Або введіть цей код на сторінці входу: ${params.code}`,
      expiresAt: (params) => `Посилання і код діють до ${params.expiresAt}.`,
      intro: 'Скористайтеся цим посиланням, щоб увійти до ChurchFlow.',
      signIn: (params) => `Увійти: ${params.url}`,
      subject: 'Посилання для входу до ChurchFlow',
    },
    emailVerification: {
      confirm: (params) => `Підтвердьте свою електронну адресу: ${params.url}`,
      expiresAt: (params) => `Це посилання діє до ${params.expiresAt}.`,
      intro: 'Підтвердьте цю адресу, щоб входити з нею до ChurchFlow.',
      subject: 'Підтвердьте електронну адресу ChurchFlow',
    },
    membershipClaim: {
      intro: (params) =>
        `Адміністратор організації підготував для вас доступ до ChurchFlow: ${params.organizationName}.`,
      expiresAt: (params) => `Це посилання діє до ${params.expiresAt}.`,
      requestAccess: (params) => `Запросити доступ: ${params.url}`,
      subject: (params) => `Підключіть доступ до ChurchFlow для ${params.organizationName}`,
    },
    notification: {
      open: (params) => `Відкрити: ${params.url}`,
      subject: (params) => `[${params.organizationName}] ${params.title}`,
    },
    organizationInvitation: {
      accept: (params) => `Прийняти запрошення: ${params.url}`,
      expiresAt: (params) => `Запрошення діє до ${params.expiresAt}.`,
      intro: (params) =>
        `Вас запрошено приєднатися до ${params.organizationName} у ролі ${params.role}.`,
      subject: (params) => `Вас запрошено приєднатися до ${params.organizationName}`,
    },
    organizationRequestAdmin: {
      labels: {
        contact: 'Контакт',
        message: 'Повідомлення',
        organization: 'Організація',
        phone: 'Телефон',
        review: 'Переглянути',
        telegramId: 'Telegram ID',
        telegramUsername: 'Telegram username',
      },
      subject: (params) => `Нова заявка на організацію: ${params.organizationName}`,
    },
    organizationRequestApproved: {
      approved: (params) => `Вашу організацію ${params.organizationName} схвалено.`,
      openDashboard: (params) => `Відкрити панель: ${params.url}`,
      owner: 'Ви є її власником.',
      subject: (params) => `Вашу організацію в ChurchFlow створено: ${params.organizationName}`,
    },
    organizationRequestRejected: {
      reason: (params) => `Причина: ${params.rejectionReason}`,
      rejected: (params) => `Вашу заявку на організацію ${params.organizationName} відхилено.`,
      subject: (params) => `Оновлення заявки на організацію: ${params.organizationName}`,
    },
  },
} as const satisfies Record<AppLocale, EmailMessageCatalog>;

export function emailMessages(locale: AppLocale): EmailMessageCatalog {
  return EMAIL_MESSAGE_CATALOG[locale];
}

export function formatEmailDateTime(value: Date, locale: AppLocale): string {
  return formatDateTime(value, {
    intlLocale: EMAIL_MESSAGE_CATALOG[locale].intlLocale,
    timeZone: EMAIL_TIME_ZONE,
  });
}
