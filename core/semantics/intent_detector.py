from langchain_core.language_models.llms import BaseLLM
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field


class IntentOutput(BaseModel):
    goal: str = Field(description="Normalized robotic goal inferred from the input")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0")


class IntentDetector:
    def __init__(self, llm: BaseLLM):
        self.llm = llm
        self.parser = JsonOutputParser(pydantic_object=IntentOutput)
        self.prompt = PromptTemplate(
            template=(
                "Extract the robotic intent from the observation.\n\n"
                "Observation: {observation}\n\n{format_instructions}"
            ),
            input_variables=["observation"],
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )
        self.chain = self.prompt | self.llm | self.parser

    def detect(self, observation: str) -> dict:
        return self.chain.invoke({"observation": observation})
