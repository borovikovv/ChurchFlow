'use client';

import PhoneInput, { type Country, type Value } from 'react-phone-number-input';
import { useState } from 'react';

export function PhoneInputField({
  name,
  defaultValue,
  defaultCountry = 'UA',
}: {
  name: string;
  defaultValue?: string;
  defaultCountry?: Country;
}) {
  const [value, setValue] = useState<Value | undefined>(defaultValue as Value | undefined);

  return (
    <PhoneInput
      className="phone-input"
      name={name}
      value={value ?? ''}
      onChange={setValue}
      defaultCountry={defaultCountry}
      international
      countryCallingCodeEditable={false}
    />
  );
}
