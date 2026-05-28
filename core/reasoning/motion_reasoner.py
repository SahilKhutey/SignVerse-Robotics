from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.language_models.llms import BaseLLM
from pydantic import BaseModel, Field
from typing import List

class FeasibilityOutput(BaseModel):
    intent: str = Field(description="The original intent passed in")
    required_skills: List[str] = Field(description="List of basic skills required to achieve this intent")
    feasibility: str = Field(description="Feasibility assessment: 'high', 'medium', or 'low'")

class MotionReasoner:
    def __init__(self, llm: BaseLLM):
        self.llm = llm
        self.parser = JsonOutputParser(pydantic_object=FeasibilityOutput)
        self.prompt = PromptTemplate(
            template="Evaluate the feasibility of the following robotic intent and list required skills.\n\nIntent: {intent}\n\n{format_instructions}",
            input_variables=["intent"],
            partial_variables={"format_instructions": self.parser.get_format_instructions()},
        )
        self.chain = self.prompt | self.llm | self.parser

    def reason(self, intent: str) -> dict:
        """
        Computes required skills and physical feasibility of an intent.
        """
        return self.chain.invoke({"intent": intent})
